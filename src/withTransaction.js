const db = require('../config/db'); // ganti sesuai lokasi koneksi pool
const makeModel = require('./Model');

async function withTransaction(callback) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Inject koneksi ke Model
    const Model = (table) => makeModel(table, conn);

    const result = await callback(conn, Model);

    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = withTransaction;
