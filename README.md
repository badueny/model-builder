Modular **SQL Query Builder dan Helper Transaksi** untuk Node.js + MySQL.
Terinspirasi dari Laravel Eloquent dan Knex.js, `model-builder` memungkinkan kamu membangun query SQL secara fleksibel dan elegan tanpa ORM besar.

## Fitur Utama

| Fitur                       | Deskripsi                                                 |
| --------------------------- | --------------------------------------------------------- |
| `select()`                  | Pilih kolom, bisa alias (`{ 'a.id': 'user_id' }`)         |
| `join()`, `leftJoin()`      | JOIN tabel lain                                           |
| `where()`, `orWhere()`      | Kondisi WHERE chaining                                    |
| `whereOp()`                 | WHERE dengan operator fleksibel (`>=`, `!=`, `LIKE`, dll) |
| `whereIn()`                 | WHERE IN untuk array nilai                                |
| `whereLikeAny()`            | LIKE di banyak kolom secara OR                            |
| `groupBy()`, `having()`     | GROUP BY dan HAVING dengan support placeholder            |
| `orderBy()`, `limit()`      | Sorting dan pembatasan hasil                              |
| `insert()`                  | Simpan 1 data                                             |
| `insertMany()`              | Simpan bulk array                                         |
| `insertUpdate()`            | UPSERT (insert or update on duplicate)                    |
| `update()`                  | Update dengan WHERE (guarded)                             |
| `delete()`                  | Hapus dengan WHERE (guarded)                              |
| `first()`                   | Ambil 1 baris data                                        |
| `get()`                     | Ambil semua hasil query                                   |
| `paginate()`                | Ambil data per halaman + total count                      |
| `count()`, `sum()`, `avg()` | Fungsi agregat                                            |
| `min()`, `max()`            | Fungsi agregat                                            |
| `exists()`                  | Boolean cepat untuk cek data                              |
| `pluck()`                   | Ambil satu kolom semua baris                              |
| `withTransaction()`         | Wrapper helper untuk transaksi otomatis                   |


## Instalasi

```bash
npm i @awenk/model-builder
```
atau

```bash
npm install github:badueny/model-builder
```
Atau
```bash
npm install git+https://github.com/badueny/model-builder.git
```

## Contoh Penggunaan

#### Basic Query
```js

const { Model, withTransaction } = require('@awenk/model-builder');

await Model('users')
  .select(['id', 'name'])
  .where('status', 'active')
  .orderBy('id', 'DESC')
  .paginate(1, 10);

await withTransaction(async (conn, Model) => {
  const userId = await Model('users').insert({ name: 'Awenk' });
  await Model('orders').insert({ user_id: userId, total: 10000 });
});

```
#### Pagination
```js

const result = await Model('products')
  .where('category_id', 1)
  .paginate(2, 10); // halaman ke-2, 10 item per halaman

console.log(result.total); // total semua
console.log(result.data);  // data halaman ini

```

#### Transaksi Otomatis

```js

const { withTransaction } = require('@awenk/model-builder');

await withTransaction(async (conn, Model) => {
  const User = Model('users');
  const Order = Model('orders');

  const userId = await User.insert({ name: 'Awenk', email: 'a@e' });

  await Order.insert({ user_id: userId, total: 100000 });
});

```

#### Insert atau Update (Upsert)

```js
await Model('settings').insertUpdate(
  { key: 'site_name', value: 'AntrianKita' },
  ['key'] // kolom unik
);

```

#### Exist, Pluck, min, max
```js

// cek ada data?
const isExist = await Model('users').where('email', email).exists();

// ambil array email saja
const emails = await Model('users').pluck('email');

// fungsi agregat lain
const lowest  = await Model('orders').min('total');
const highest = await Model('orders').max('total');

````

#### Contoh DataTables Server-side

```js

const { Model } = require('@awenk/model-builder');

router.post('/datatable/users', async (req, res) => {
  const { start, length, search, order, columns } = req.body;

  const page     = Math.floor(start / length) + 1;
  const perPage  = parseInt(length);
  const keyword  = search?.value || '';
  const orderCol = columns[order[0].column].data;
  const dir      = order[0].dir.toUpperCase();

  const query = Model('users')
    .select(['id', 'name', 'email', 'role'])
    .whereLikeAny(['name', 'email', 'role'], keyword)
    .orderBy(orderCol, dir);

  const result = await query.paginate(page, perPage);

  res.json({
    draw: req.body.draw,
    recordsTotal: result.total,
    recordsFiltered: result.total,
    data: result.data
  });
});

```

#### Integrasi MySQL Pool
Contoh `config/db.js`:
```js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  database: 'mydb',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;

````
```yaml

## ✅ Cara Jalankan Contoh Lokal

Pastikan kamu sudah punya koneksi `config/db.js` yang mengekspor pool `mysql2/promise`.

Lalu:

```bash
git clone https://github.com/badueny/model-builder.git
cd model-builder
npm install
node examples/example.js

```
📜 Lisensi.
MIT License — bebas digunakan dan dimodifikasi.

