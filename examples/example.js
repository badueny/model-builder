const { Model, withTransaction } = require('../index');

// Contoh tanpa transaksi
async function simpleQuery() {
  const Users = Model('users');
  const list = await Users
    .select(['id', 'name', 'email'])
    .where('status', 'active')
    .orderBy('id', 'DESC')
    .limit(5)
    .get();

  console.log(list);
}

// Contoh transaksi
async function createUserWithOrder() {
  await withTransaction(async (conn, Model) => {
    const Users = Model('users');
    const Orders = Model('orders');

    const userId = await Users.insert({ name: 'Awenk', email: 'a@e' });
    await Orders.insert({ user_id: userId, total: 200000 });

    console.log('Data tersimpan dengan transaksi');
  });
}
