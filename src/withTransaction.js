const db = require('../../../../config/db'); //← Sesuaikan dengan lokasi konfig awal db
const makeModel = require('./Model');

async function withTransaction(callback) {
  const conn = await db.getConnection();
  console.log('🔌 [TX] Connection opened');

  try {
    await conn.beginTransaction();
    console.log('🔐 [TX] Transaction started');

    const Model = (table) => makeModel(table, conn);
    const result = await callback(conn, Model);

    await conn.commit();
    console.log('✅ [TX] Committed');
    return result;
  } catch (err) {
    await conn.rollback();
    console.error('❌ [TX] Rolled back:', err.message);
    throw err;
  } finally {
    conn.release();
    console.log('🔚 [TX] Connection released');
  }
}

module.exports = withTransaction;
