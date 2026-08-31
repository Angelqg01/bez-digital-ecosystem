/**
 * FeeOverride — tarifa negociada por wallet para BezPay.
 *
 * Existe para una sola cosa: que dar una tarifa preferente a una cuenta
 * grande no obligue a cambiar el 1,5% global (calculatePaymentAmounts en
 * bezpay.service.js) para todos los demás clientes a la vez.
 */
'use strict';

const pool = require('../../db/pool');

/**
 * Tarifa vigente para una wallet, o null si no tiene acuerdo (usa el
 * feeRate por defecto). No lanza si la wallet no existe — ausencia de fila
 * es el caso normal, no un error.
 */
async function getFeeRate(walletAddress) {
  if (!walletAddress) return null;
  const { rows } = await pool.query(
    'SELECT fee_rate FROM bezpay_fee_overrides WHERE wallet_address = $1',
    [String(walletAddress).toLowerCase()]
  );
  return rows[0] ? Number(rows[0].fee_rate) : null;
}

/** Da de alta o actualiza la tarifa de una wallet. */
async function setFeeRate(walletAddress, feeRate, { note = null, createdBy = null } = {}) {
  const { rows } = await pool.query(
    `INSERT INTO bezpay_fee_overrides (wallet_address, fee_rate, note, created_by, updated_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (wallet_address)
     DO UPDATE SET fee_rate = $2, note = $3, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [String(walletAddress).toLowerCase(), feeRate, note, createdBy]
  );
  return rows[0];
}

/** Quita el acuerdo — la wallet vuelve a la tarifa por defecto. */
async function removeFeeRate(walletAddress) {
  const { rowCount } = await pool.query(
    'DELETE FROM bezpay_fee_overrides WHERE wallet_address = $1',
    [String(walletAddress).toLowerCase()]
  );
  return rowCount > 0;
}

async function listAll() {
  const { rows } = await pool.query(
    'SELECT * FROM bezpay_fee_overrides ORDER BY updated_at DESC'
  );
  return rows;
}

module.exports = { getFeeRate, setFeeRate, removeFeeRate, listAll };
