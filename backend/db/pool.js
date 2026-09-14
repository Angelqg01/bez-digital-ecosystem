const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://bezhas:bezhas_password@localhost:5433/bezhas',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  // Cierra las conexiones abiertas. Sin esto el proceso —o una suite de
  // pruebas— se queda colgado con el pool vivo hasta que algo lo mata.
  end: () => pool.end(),
};
