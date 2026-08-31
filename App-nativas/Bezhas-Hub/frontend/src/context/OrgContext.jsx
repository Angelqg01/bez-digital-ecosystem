/**
 * OrgContext — contexto multi-tenant del cliente (Organización → Sede activa).
 *
 * Mantiene la organización y la sede seleccionadas, las persiste en
 * localStorage (`bezhas-org-id` / `bezhas-site-id`) y deja que el interceptor
 * de services/http.js inyecte `X-Org-Id` / `X-Site-Id` en TODAS las llamadas.
 * Así el holding/empresa opera "como" una sede concreta sin tocar cada fetch.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import http from '../services/http';

const OrgContext = createContext(null);

const LS_ORG = 'bezhas-org-id';
const LS_SITE = 'bezhas-site-id';

export function OrgProvider({ children }) {
  const [orgs, setOrgs] = useState([]);
  const [sites, setSites] = useState([]);
  const [orgId, setOrgIdState] = useState(() => localStorage.getItem(LS_ORG) || null);
  const [siteId, setSiteIdState] = useState(() => localStorage.getItem(LS_SITE) || null);
  const [loading, setLoading] = useState(false);

  const org = orgs.find((o) => o.id === orgId) || null;
  const site = sites.find((s) => s.id === siteId) || null;

  // Cargar organizaciones del actor (usa JWT/wallet del interceptor).
  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await http.get('/api/organizations');
      const list = data?.organizations || [];
      setOrgs(list);
      // Auto-seleccionar la primera si no hay ninguna válida.
      if (list.length && !list.some((o) => o.id === localStorage.getItem(LS_ORG))) {
        setOrg(list[0].id);
      }
    } catch {
      setOrgs([]); // sin sesión o sin orgs: no rompe la UI
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar sedes cuando cambia la organización.
  useEffect(() => {
    if (!orgId) { setSites([]); return; }
    let cancel = false;
    http.get(`/api/organizations/${orgId}/sites`)
      .then(({ data }) => { if (!cancel) setSites(data?.sites || []); })
      .catch(() => { if (!cancel) setSites([]); });
    return () => { cancel = true; };
  }, [orgId]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  const setOrg = useCallback((id) => {
    setOrgIdState(id || null);
    setSiteIdState(null); // resetear sede al cambiar de org
    if (id) localStorage.setItem(LS_ORG, id); else localStorage.removeItem(LS_ORG);
    localStorage.removeItem(LS_SITE);
  }, []);

  const setSite = useCallback((id) => {
    setSiteIdState(id || null);
    if (id) localStorage.setItem(LS_SITE, id); else localStorage.removeItem(LS_SITE);
  }, []);

  const value = {
    orgs, sites, org, site, orgId, siteId, loading,
    setOrg, setSite, refresh: loadOrgs,
  };
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within an OrgProvider');
  return ctx;
}

export default OrgContext;
