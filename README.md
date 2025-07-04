Modular **SQL Query Builder dan Helper Transaksi** untuk **Node.js + MySQL**.
Terinspirasi dari *Laravel Eloquent dan Knex.js*, `model-builder` memungkinkan kamu membangun query SQL secara fleksibel dan elegan tanpa ORM besar.

## Fitur Utama

| Fitur                       | Deskripsi                                                 |
| --------------------------- | --------------------------------------------------------- |
| `select()`                  | Pilih kolom, bisa alias (`{ 'a.id': 'user_id' }`)         |
| `join()`, `leftJoin()`      | JOIN tabel lain                                           |
| `where()`, `orWhere()`      | Kondisi WHERE chaining                                    |
| `whereOp()`                 | WHERE dengan operator fleksibel (`>=`, `!=`, `LIKE`, dll) |
| `whereIn()`                 | WHERE IN untuk array nilai                                |
| `whereLikeAny()`            | LIKE di banyak kolom secara OR                            |
| `prependParam()`            | mengatur urutan parameter Subquery SQL dalam select       |
| `groupBy()`, `having()`     | GROUP BY dan HAVING dengan support placeholder            |
| `orderBy()`, `limit()`      | Sorting dan pembatasan hasil                              |
| `insert()`                  | Simpan 1 data                                             |
| `insertMany()`              | Simpan bulk array                                         |
| `insertUpdate()`            | UPSERT (insert or update on duplicate)                    |
| `upsertMany()`              | Bulk UPSERT (insert or update ON DUPLICATE KEY UPDATE)    |
| `update()`                  | Update dengan WHERE (guarded)                             |
| `delete()`                  | Hapus dengan WHERE (guarded)                              |
| `increment()`,`decrement()` | Modifikasi nilai kolom tanpa ambil data dulu.             |
| `first()`                   | Ambil 1 baris data                                        |
| `get()`                     | Ambil semua hasil query                                   |
| `paginate()`                | Ambil data per halaman + total count                      |
| `count()`, `sum()`, `avg()` | Fungsi agregat                                            |
| `min()`, `max()`            | Fungsi agregat                                            |
| `exists()`                  | Boolean cepat untuk cek data                              |
| `pluck()`                   | Ambil satu kolom semua baris                              |
| `withTransaction()`         | Wrapper helper untuk transaksi otomatis dan               |
|                             | Commit otomatis jika sukses, rollback jika error.         |
| `enableAudit()`	      | Catatan log transaksi otomatis				  |

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

#### Insert atau Update Banyak (Bulk Upsert)
```js

await Model('products').upsertMany(
  [
    { id: 1, name: 'Kopi',  stock: 100 },
    { id: 2, name: 'Teh',   stock: 80  }
  ],
  ['name', 'stock']       // kolom yg diupdate jika duplicate
);

````

#### Increment decrement
```js
// tambah stok 5
await Model('products').where('id', pid).increment('stock', 5);

// kurangi saldo 10.000,-
await Model('users').where('id', uid).decrement('balance', 10000);
```

#### Exist, Pluck, min, max
```js

// cek ada data?
const isExist = await Model('users').where('email', email).exists(); //output -> true|false

// ambil array email saja
const emails = await Model('users').pluck('email'); //output -> ambil array satu kolom tanpa harus select

// fungsi agregat lain
const lowest  = await Model('orders').min('total'); //output -> nilai terendah
const highest = await Model('orders').max('total'); //output -> nilai tertinggi

````
#### prependParam Subquery SQL Support
berguna untuk mengatur urutan parameter Subquery SQL didalam select.
```js
const model = Model('table a');
model.select(
  {'a.name':'name',
  ['(SELECT COUNT(*) FROM tableb WHERE extra_coloumn = ?']: 'total'
})
.where('id', 1)
.prependParam('extra_value')
.get();
```
akan mendapatkan hasil SQL:
```sql
SELECT 
	a.name AS name, 
	(SELECT COUNT(*) FROM tableb WHERE extra_coloumn = 'extra_value') AS total 
FROM table a 
WHERE a.id=1
```

#### Contoh Penggunaan Untuk DataTables Server-side

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

#### Audit Log
Struktur Audit Table.
```sql
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50),
    action CHAR(250),
    record_id VARCHAR(36),
    before_data JSON,
    after_data JSON,
    user_id CHAR(36),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
```
Penggunaan:
.enableAudit(table, meta); 
```sql
await Model('users')
  .where('id', 5)
  .enableAudit('audit_log', { userId: 'admin123' })
  .update({ name: 'Awenk' });
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

## Instalasi

```bash
npm install github:badueny/model-builder
```
atau
```bash
npm install git+https://github.com/badueny/model-builder.git
```

## ✅ Cara Jalankan Contoh Lokal

```yaml
Pastikan kamu sudah punya koneksi `config/db.js` yang mengekspor pool `mysql2/promise`.
````
```bash
git clone https://github.com/badueny/model-builder.git
cd model-builder
npm install
node examples/example.js

```
📜 Lisensi.
MIT License — Bebas digunakan dan dimodifikasi.

