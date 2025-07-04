const db = require('../../../../config/db'); //← Sesuaikan dengan lokasi konfig awal db

class Model {
  constructor(table, conn = null) {
    this.table = table;
    this.conn = conn; // ← koneksi manual (transaksi), jika ada
    this._select = '*';
    this._joins = '';
    this._wheres = '';
    this._groupBy = '';
    this._having = '';
    this._orderBy = '';
    this._limit = '';
    this._values = [];
  }

  /*───────BASIC SELECT──────*/
  //update select;
  select(columns = '*') {
  if (typeof columns === 'string') {
    this._select = columns;
  } else if (Array.isArray(columns)) {
    this._select = columns.map(col => this._wrapIfNeeded(col)).join(', ');
  } else if (typeof columns === 'object' && columns !== null) {
    this._select = Object.entries(columns)
      .map(([col, alias]) => `${this._wrapIfNeeded(col)} AS \`${alias}\``)
      .join(', ');
  } else {
    this._select = '*';
  }
  return this;
}



  _wrapIfNeeded(col) {
    // Jika ada fungsi SQL atau operator
    if (/[\s()+\-*/%]/.test(col) || /\(.+\)/.test(col)) return col;

    // Jika format alias.column → jangan bungkus
    if (/^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/.test(col)) return col;

    // Kolom biasa → bungkus
    return `\`${col}\``;
  }

  /*───── JOIN ──────*/
  join(table, onClause) {
    this._joins += ` INNER JOIN ${table} ON ${onClause}`;
    return this;
  }

  leftJoin(table, onClause) {
    this._joins += ` LEFT JOIN ${table} ON ${onClause}`;
    return this;
  }

  /*───── WHERE ──────*/
  where(column, value) {
    this._wheres += this._wheres ? ` AND ${column} = ?` : `WHERE ${column} = ?`;
    this._values.push(value);
    return this;
  }

  whereWithOperator(column, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    this._wheres += this._wheres ? ` AND ${column} ${operator} ?` : `WHERE ${column} ${operator} ?`;
    this._values.push(value);
    return this;
  }

  //.whereOp('age', '>=', 18)
  whereOp(column, operator, value) {
    return this.whereWithOperator(column, operator, value);
  }

  whereMultiOp(conditions = []) {
    for (const cond of conditions) {
      const { column, operator = '=', value } = cond;

      if (operator.toUpperCase() === 'IN' && Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        this._wheres += this._wheres
          ? ` AND ${column} IN (${placeholders})`
          : `WHERE ${column} IN (${placeholders})`;
        this._values.push(...value);
      } else {
        this._wheres += this._wheres
          ? ` AND ${column} ${operator} ?`
          : `WHERE ${column} ${operator} ?`;
        this._values.push(value);
      }
    }
    return this;
  }

  orWhere(column, value) {
    this._wheres += this._wheres ? ` OR ${column} = ?` : `WHERE ${column} = ?`;
    this._values.push(value);
    return this;
  }

  orWhereWithOperator(column, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    this._wheres += this._wheres ? ` OR ${column} ${operator} ?` : `WHERE ${column} ${operator} ?`;
    this._values.push(value);
    return this;
  }

  orWhereOp(column, operator, value) {
    return this.orWhereWithOperator(column, operator, value);
  }

  orWhereMultiOp(conditions = []) {
    if (!conditions.length) return this;

    const parts = [];
    for (const { column, operator = '=', value } of conditions) {
      parts.push(`${column} ${operator} ?`);
      this._values.push(value);
    }

    const clause = parts.join(' OR ');
    if (this._wheres) {
      this._wheres += ` AND (${clause})`;
    } else {
      this._wheres = `WHERE (${clause})`;
    }

    return this;
  }

  whereIn(column, values = []) {
    if (!Array.isArray(values) || values.length === 0) return this;
    const placeholders = values.map(() => '?').join(', ');
    this._wheres += this._wheres ? ` AND ${column} IN (${placeholders})` : `WHERE ${column} IN (${placeholders})`;
    this._values.push(...values);
    return this;
  }

  whereLikeAny(columns, search) {
    if (!Array.isArray(columns) || !search) return this;
    const likeClauses = columns.map(col => `${col} LIKE ?`).join(' OR ');
    const likeValues = columns.map(() => `%${search}%`);
    this._wheres += this._wheres
      ? ` AND (${likeClauses})`
      : `WHERE (${likeClauses})`;
    this._values.push(...likeValues);
    return this;
  }

  /*───────────────────────────
  │ GROUP / HAVING / ORDER / LIMIT
  ───────────────────────────*/
  groupBy(columns) {
    if (Array.isArray(columns)) {
      this._groupBy = ` GROUP BY ${columns.join(', ')}`;
    } else {
      this._groupBy = ` GROUP BY ${columns}`;
    }
    return this;
  }

  having(condition, value) {
    this._having = ` HAVING ${condition}`;
    if (value !== undefined) this._values.push(value);
    return this;
  }

  orderBy(column, direction = 'ASC') {
    this._orderBy = ` ORDER BY ${column} ${direction.toUpperCase()}`;
    return this;
  }

  limit(n) {
    this._limit = ` LIMIT ${parseInt(n)}`;
    return this;
  }

  /*──────────── preped Param ──────────
  │ prependParam(value) – menambahkan nilai ke awal array _values
  |
  │ Catatan: ini berguna untuk mengatur urutan parameter query SQL didalam select 
  │ Contoh:
  │   const model = Model('table a');
  │   model.select({'a.name':'name',['(SELECT COUNT(*) FROM tableb WHERE extra_coloumn = ?']: 'total'}).where('id', 1).prependParam('extra_value').get();
  │   // SQL: SELECT a.name AS name, (SELECT COUNT(*) FROM tableb WHERE extra_coloumn = ?) AS total FROM table a WHERE id = ?
  │   // _values: ['extra_value'], 1]  
  │   // Ini akan memastikan 'extra_value' ada di awal _values
  | GUNAKAN prependParam(['extra_value_1','extra_value_2']); //jika query select lebih dari satu
  ───────────────────────────*/
  prependParam(value) {
    if (Array.isArray(value)) {
    this._values = [...value, ...this._values];
    } else {
      this._values.unshift(value);
    }
    return this;
  }

  /*───────── CLONE ────────────
  │ duplikasi state builder (berguna untuk count(), exists(), dsb.)
  ───────────────────────────*/
  clone() {
    const dup            = new Model(this.table, this.conn);
    dup._select          = this._select;
    dup._joins           = this._joins;
    dup._wheres          = this._wheres;
    dup._groupBy         = this._groupBy;
    dup._having          = this._having;
    dup._orderBy         = this._orderBy;
    dup._limit           = this._limit;
    dup._values          = [...this._values];
    return dup;
  }

  /*───── BUILD & DEBUG ──────*/
  _buildSQL() {
    return `SELECT ${this._select} FROM ${this.table}${this._joins}${this._wheres ? ' ' + this._wheres : ''}${this._groupBy}${this._having}${this._orderBy}${this._limit}`;
  }

  debug() {
    console.log(this._buildSQL());
    console.log(this._values);
    return this;
  }

  /*───── GETTERS ──────*/
  async get() {
    const sql = this._buildSQL();
    const runner = this.conn || db; // ← gunakan koneksi manual jika ada
    const [rows] = await runner.query(sql, this._values);
    this._reset();
    return rows;
  }

  async first() {
    this.limit(1);
    const [row] = await this.get();
    return row || null;
  }

  /*───── PAGINATE ──────*/
  async paginate(page = 1, perPage = 10) {
    const offset = (page - 1) * perPage;
    const sql = `SELECT ${this._select} FROM ${this.table}${this._joins} ${this._wheres}${this._groupBy}${this._having}${this._orderBy} LIMIT ? OFFSET ?`;
    const values = [...this._values, perPage, offset];
    const runner = this.conn || db;
    const [data] = await runner.query(sql, values);

    const countSql = `SELECT COUNT(*) AS total FROM ${this.table}${this._joins} ${this._wheres}${this._groupBy}${this._having}`;
    const [countResult] = await runner.query(countSql, this._values);
    const total = countResult[0]?.total || 0;
    const lastPage = Math.ceil(total / perPage);

    this._reset();
    return { data, total, page, perPage, lastPage };
  }

  /*──────── COUNTING ────────
  │ COUNT / SUM / AVG / MIN / MAX
  ───────────────────────────*/
  async count(column = '*') {
    this._select = `COUNT(${column}) AS total`;
    const runner = this.conn || db;
    const [rows] = await runner.query(this._buildSQL(), this._values);
    this._reset();
    return rows[0]?.total || 0;
  }

  async sum(column) {
    this._select = `SUM(${column}) AS total`;
    const runner = this.conn || db;
    const [rows] = await runner.query(this._buildSQL(), this._values);
    this._reset();
    return rows[0]?.total || 0;
  }

  async avg(column) {
    this._select = `AVG(${column}) AS average`;
    const runner = this.conn || db;
    const [rows] = await runner.query(this._buildSQL(), this._values);
    this._reset();
    return rows[0]?.average || 0;
  }
  
  async min(col){
    this._select=`MIN(${col}) AS min`; const [r]=await (this.conn||db).query(this._buildSQL(),this._values); this._reset(); return r[0]?.min||null; } // 🔹 NEW
  async max(col){
    this._select=`MAX(${col}) AS max`; const [r]=await (this.conn||db).query(this._buildSQL(),this._values); this._reset(); return r[0]?.max||null; } // 🔹 NEW

  /*───────────────────────────
  │ EXISTS – boolean cepat 
  ───────────────────────────*/
  async exists() {
    const clone = this.clone().select('1').limit(1);
    const [r]   = await (clone.conn||db).query(clone._buildSQL(), clone._values);
    return r.length > 0;
  }

  /*───────────────────────────
  │ PLUCK – ambil satu kolom semua baris 
  ───────────────────────────*/
  async pluck(column) {
    const rows = await this.select(column).get();
    return rows.map(r => r[column]);
  }

  /*─────── TRANSACTIONS ────────
  │ INSERT / BULK INSERT / UPSERT / UPDATE / DELETE
  ───────────────────────────*/

    /* ---------- INSERT ---------- */
  async insert(data = {}) {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const ph   = cols.map(() => '?').join(', ');
    const sql  = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${ph})`;
    const runner = this.conn || db;
    const [res] = await runner.query(sql, vals);
    return res.insertId;
  }

  /* ---------- BULK INSERT ---------- */
  async insertMany(rows = []) {
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    const cols = Object.keys(rows[0]);
    const phRow = `(${cols.map(() => '?').join(', ')})`;
    const phAll = rows.map(() => phRow).join(', ');
    const vals  = rows.flatMap(obj => cols.map(c => obj[c]));
    const sql   = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES ${phAll}`;
    const runner = this.conn || db;
    const [res] = await runner.query(sql, vals);
    return res.affectedRows;          // jumlah data tersimpan
  }

  /* ---------- INSERT or UPDATE (UPSERT) ---------- */
  async insertUpdate(data = {}, conflictCols = []) {
    const insertId = await this.insert(data);
    const updateCols = Object.keys(data)
      .filter(c => !conflictCols.includes(c))
      .map(c => `${c}=VALUES(${c})`)
      .join(', ');
    if (!updateCols) return insertId;
    const cols = Object.keys(data);
    const ph   = cols.map(() => '?').join(', ');
    const sql  = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${ph}) 
                  ON DUPLICATE KEY UPDATE ${updateCols}`;
    const runner = this.conn || db;              
    await runner.query(sql, Object.values(data));
    return insertId;
  }

  /* ---------- BULK UPSERT ---------- */                     
  /**
   * upsertMany(rows, updateCols = [])  
   * - rows        : array of objects
   * - updateCols  : kolom yang perlu di‑update saat duplicate.  
   *                 Kosong ⇒ semua kolom kecuali PK.
   */
  async upsertMany(rows = [], updateCols = []) {
    if (!Array.isArray(rows) || rows.length === 0) return 0;
  
    const cols   = Object.keys(rows[0]);
    const phRow  = `(${cols.map(() => '?').join(', ')})`;
    const phAll  = rows.map(() => phRow).join(', ');
    const vals   = rows.flatMap(r => cols.map(c => r[c]));
  
    // kalau updateCols belum ditentukan, update semua kecuali kolom pertama (anggap PK)
    if (updateCols.length === 0) updateCols = cols.slice(1);
  
    const updates = updateCols.map(c => `${c}=VALUES(${c})`).join(', ');
  
    const sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES ${phAll}
                 ON DUPLICATE KEY UPDATE ${updates}`;
  
    const [res] = await (this.conn || db).query(sql, vals);
    return res.affectedRows;      // insert + update rows (MySQL behaviour)
  }
  
  /* ---------- UPDATE ---------- */
  async update(data = {}) {
    if (!this._wheres) throw new Error('update() membutuhkan where()!');
    const sql = `UPDATE ${this.table} SET ${Object.keys(data).map(k => `${k}=?`).join(', ')} ${this._wheres}`;
    const vals = [...Object.values(data), ...this._values];
    const runner = this.conn || db;
    const [res] = await runner.query(sql, vals);
    this._reset();
    return res.affectedRows;
  }

  /* ---------- DELETE ---------- */
  async delete() {
    if (!this._wheres) throw new Error('delete() membutuhkan where()!');
    const sql = `DELETE FROM ${this.table} ${this._wheres}`;
    const runner = this.conn || db;   
    const [res] = await runner.query(sql, this._values);
    this._reset();
    return res.affectedRows;
  }

  /* ---------- INCREMENT / DECREMENT ---------- */           
  async increment(column, amount = 1) {
    if (!this._wheres) throw new Error('increment() membutuhkan where()!');
    const sql   = `UPDATE ${this.table} SET ${column} = ${column} + ? ${this._wheres}`;
    const vals  = [amount, ...this._values];
    const [res] = await (this.conn || db).query(sql, vals);
    this._reset();
    return res.affectedRows;
  }
  
  async decrement(column, amount = 1) {                       
    return this.increment(column, -amount);
  }

  /*─────── RESET ───────*/
  _reset() {
    this._select = '*';
    this._joins = '';
    this._wheres = '';
    this._groupBy = '';
    this._having = '';
    this._orderBy = '';
    this._limit = '';
    this._values = [];
  }
}


module.exports = (table, conn = null) => new Model(table, conn);
