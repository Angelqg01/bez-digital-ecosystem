'use strict';

/**
 * cargoGeofence — geofence CRUD + point evaluation for BZ CargoLink.
 *
 * Fences are circles (center + radius in meters) or polygons ([[lat,lng],...]),
 * bound to a B-UID or owner-wide. Two roles in the rule engine:
 *
 *   * "authorized zones" (port | customs | warehouse): opening an e-seal INSIDE
 *     one of these is a legitimate inspection; OUTSIDE them it is tampering.
 *   * "route corridors" (route_corridor, enforce=TRUE): a GPS fix outside ALL
 *     enforced corridors emits GEOFENCE_EXIT.
 */

const { query } = require('../db/pool');
const lifecycle = require('./cargoLinkLifecycle');

const EARTH_RADIUS_M = 6371000;
const KINDS = ['port', 'customs', 'warehouse', 'route_corridor'];
const UNSEAL_AUTHORIZED_KINDS = ['port', 'customs', 'warehouse'];

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Haversine distance in meters. */
function distanceM(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function pointInCircle(lat, lng, fence) {
  if (fence.center_lat === null || fence.center_lng === null || !fence.radius_m) return false;
  return distanceM(lat, lng, Number(fence.center_lat), Number(fence.center_lng)) <= Number(fence.radius_m);
}

/** Ray-casting point-in-polygon. polygon = [[lat,lng], ...]. */
function pointInPolygon(lat, lng, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i].map(Number);
    const [latJ, lngJ] = polygon[j].map(Number);
    const intersects =
      lngI > lng !== lngJ > lng &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInFence(lat, lng, fence) {
  if (fence.polygon) return pointInPolygon(lat, lng, fence.polygon);
  return pointInCircle(lat, lng, fence);
}

/**
 * Evaluate a GPS point against a shipment's fences (pure — unit-testable).
 * Returns:
 *   verified            — inside at least one fence (NULL semantics handled by caller)
 *   matched             — names of fences containing the point
 *   authorizedForUnseal — inside a port/customs/warehouse zone (e-seal may open)
 *   corridorExit        — enforced route corridors exist and the point is outside ALL of them
 */
function evaluatePoint(lat, lng, fences = []) {
  const active = fences.filter((f) => f.status === 'active');
  const matched = active.filter((f) => pointInFence(lat, lng, f));
  const corridors = active.filter((f) => f.kind === 'route_corridor' && f.enforce);
  const insideCorridor = corridors.some((f) => pointInFence(lat, lng, f));
  return {
    verified: active.length > 0 ? matched.length > 0 : null,
    matched: matched.map((f) => f.name),
    authorizedForUnseal: matched.some((f) => UNSEAL_AUTHORIZED_KINDS.includes(f.kind)),
    corridorExit: corridors.length > 0 && !insideCorridor,
  };
}

/** Load the fences that apply to a shipment (B-UID-bound + owner-wide). */
async function fencesFor(bezhasId, bUid) {
  const { rows } = await query(
    `SELECT id, name, kind, center_lat, center_lng, radius_m, polygon, enforce, status
       FROM cargolink_geofences
      WHERE bezhas_id = $1 AND status = 'active' AND (b_uid = $2 OR b_uid IS NULL)
      ORDER BY id ASC`,
    [bezhasId, bUid || null]
  );
  return rows;
}

/** Owner registers a geofence (circle or polygon). */
async function createGeofence(req, body = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!['pos', 'admin'].includes(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot manage geofences (only pos/admin)`, 403);
  }
  if (!body.name) throw httpError('name is required', 400);
  const kind = body.kind || 'port';
  if (!KINDS.includes(kind)) throw httpError(`Invalid kind. One of: ${KINDS.join(', ')}`, 400);

  const hasCircle = body.centerLat !== undefined && body.centerLng !== undefined && body.radiusM;
  const hasPolygon = Array.isArray(body.polygon) && body.polygon.length >= 3;
  if (!hasCircle && !hasPolygon) {
    throw httpError('Provide centerLat+centerLng+radiusM (circle) or polygon [[lat,lng],...] (>=3 vertices)', 400);
  }

  const { rows } = await query(
    `INSERT INTO cargolink_geofences
       (bezhas_id, b_uid, name, kind, center_lat, center_lng, radius_m, polygon, enforce)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
     RETURNING id, b_uid, name, kind, center_lat, center_lng, radius_m, polygon, enforce, status, created_at`,
    [
      identity.bezhasId, body.bUid || null, body.name, kind,
      hasCircle ? Number(body.centerLat) : null,
      hasCircle ? Number(body.centerLng) : null,
      hasCircle ? Number(body.radiusM) : null,
      hasPolygon ? JSON.stringify(body.polygon) : null,
      Boolean(body.enforce),
    ]
  );
  return { success: true, geofence: rows[0] };
}

async function listGeofences(req, { bUid } = {}) {
  const identity = await lifecycle.resolveIdentity(req);
  const rows = await fencesFor(identity.bezhasId, bUid || null);
  return { success: true, count: rows.length, geofences: rows };
}

async function deleteGeofence(req, id) {
  const identity = await lifecycle.resolveIdentity(req);
  if (!['pos', 'admin'].includes(identity.role)) {
    throw httpError(`Role '${identity.role}' cannot manage geofences (only pos/admin)`, 403);
  }
  const { rows } = await query(
    `UPDATE cargolink_geofences SET status = 'deleted'
      WHERE id = $1 AND bezhas_id = $2 AND status = 'active'
      RETURNING id, name`,
    [id, identity.bezhasId]
  );
  if (!rows.length) throw httpError('Geofence not found', 404);
  return { success: true, deleted: rows[0] };
}

module.exports = {
  distanceM,
  pointInCircle,
  pointInPolygon,
  evaluatePoint,
  fencesFor,
  createGeofence,
  listGeofences,
  deleteGeofence,
  UNSEAL_AUTHORIZED_KINDS,
};
