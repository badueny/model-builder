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

## 🧱 Method Builder

### 📄 Select

```js
.select('*')
.select(['id', 'name'])
.select({ 'u.name': 'nama', 'COUNT(*)': 'total' })  // alias dan fungsi
```

### 🔍 Where & Filter

```js
.where('status', 'active')
.whereOp('age', '>=', 18)
.orWhere('role', 'editor')
.whereIn('id', [1, 2, 3])
.whereLikeAny(['name', 'email'], 'admin')
.whereMultiOp([{ column: 'status', operator: '=', value: 'active' }])
```

### 🔗 Join

```js
.join('roles r', 'r.id = u.role_id')
.leftJoin('profiles p', 'p.user_id = u.id')
```

### 📦 Group / Having / Order / Limit

```js
.groupBy(['role', 'status'])
.having('COUNT(*) > ?', 5)
.orderBy('created_at', 'desc')
.limit(10)
.offset(5)
```

---

## 💳 Eksekusi

| Method        | Keterangan                     |
|---------------|--------------------------------|
| `.get()`      | Ambil semua hasil              |
| `.first()`    | Ambil 1 data (LIMIT 1)         |
| `.exists()`   | Cek apakah ada data            |
| `.pluck(col)` | Ambil semua isi 1 kolom        |
| `.debug()`    | Lihat query SQL & value        |
| `.clone()`    | Duplikat instance builder      |

---

## 🔢 Increment / Decrement

```js
await Model('produk')
  .where('id', 'PRD001')
  .increment('stok');         // stok + 1

await Model('produk')
  .where('id', 'PRD001')
  .decrement('stok', 3);      // stok - 3
```

> ⚠️ Wajib gunakan `.where()` agar aman. Tanpa `WHERE`, akan throw error.

---

## 🔄 Insert / Update / Delete

```js
.insert({ name: 'John' })
.insertMany([{...}, {...}])
.insertUpdate({ id: 1, name: 'Baru' }, ['id'])  // upsert

.update({ name: 'Update' }).where('id', 1)
.delete().where('id', 1)
```

---

## 🔍 Aggregate

```js
.count('id')
.sum('jumlah')
.avg('nilai')
.min('stok')
.max('harga')
```

---

## 📑 Pagination

```js
const result = await Model('users').paginate(2, 10);
console.log(result);
/*
{
  data: [...],
  total: 123,
  page: 2,
  perPage: 10,
  lastPage: 13
}
*/
```

---

## 💡 Subquery Support

```js
.select({
  'ss.id': 'id',
  ['(SELECT COUNT(*) FROM queues q WHERE q.slot_id = ss.id AND DATE(q.waktu_booking) = ? AND q.status IN ("booking","proses"))']: 'jumlah_booking'
})
.prepend('2025-06-27')
```

---

## 🧩 Utilities

```js
.prepend('value')             // prepend 1 param
.prepend(['v1', 'v2'])        // prepend multiple
.debug()                      // log query SQL dan values
.clone()                      // clone instance builder
```

---

## 🔐 Keamanan

- Query menggunakan parameter `?` → aman dari SQL injection
- Subquery aman dengan `.prepend()`
- Tidak ada interpolasi nilai langsung ke query

---

## 🧪 Transaksi

```js
const conn = await db.getConnection();
await conn.beginTransaction();

await Model('users', conn).insert({ name: 'A' });
await Model('logs', conn).insert({ message: 'OK' });

await conn.commit();
conn.release();
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
## ✅ Instalasi

```bash
npm install github:badueny/model-builder
```
atau
```bash
npm install git+https://github.com/badueny/model-builder.git
```
```yaml
Pastikan kamu sudah punya koneksi `config/db.js` yang mengekspor pool `mysql2/promise`.
````
#### Integrasi MySQL Pool
Isi file -> `config/db.js`:
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

##  Cara Jalankan Contoh Lokal
```bash
git clone https://github.com/badueny/model-builder.git
cd model-builder
npm install
node examples/example.js

```
📜 Lisensi.
MIT License — Bebas digunakan dan dimodifikasi.

