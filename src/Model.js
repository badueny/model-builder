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
    this._auditTable = null;
    this._auditMeta = {};
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

  /*───────── JOIN ─────────*/
  join(table, on)      { this._joins += ` INNER JOIN ${table} ON ${on}`; return this; }
  leftJoin(table, on)  { this._joins += ` LEFT JOIN ${table}  ON ${on}`; return this; }


  /*─────── WHERE ─────────*/
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
  groupBy(cols) {
    this._groupBy = ` GROUP BY ${Array.isArray(cols) ? cols.join(', ') : cols}`;
    return this;
  }
  having(cond, val) { this._having = ` HAVING ${cond}`; if (val!==undefined) this._values.push(val); return this; }
  orderBy(col, dir='ASC') { this._orderBy = ` ORDER BY ${col} ${dir.toUpperCase()}`; return this; }
  limit(n) { this._limit = ` LIMIT ${parseInt(n)}`; return this; }

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

  /*───────────────────────────
  │ CLONE  
  │  – duplikasi state builder (berguna untuk count(), exists(), dsb.)
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

  /*───────────────────────────
  │ BUILD & DEBUG
  ───────────────────────────*/
  _buildSQL() {
    return `SELECT ${this._select} FROM ${this.table}${this._joins}${this._wheres ? ' ' + this._wheres : ''}${this._groupBy}${this._having}${this._orderBy}${this._limit}`;
  }
  debug() { console.log(this._buildSQL()); console.log(this._values); return this; }

  /*───────────────────────────
  │ GETTERS
  ───────────────────────────*/
  async get()   { const [r]=await (this.conn||db).query(this._buildSQL(),this._values); this._reset(); return r; }
  async first() { this.limit(1); const [r]=await this.get(); return r||null; }

  /*───────────────────────────
  │ COUNT / SUM / AVG  
  ───────────────────────────*/
  async min(col){
    this._select=`MIN(${col}) AS min`; const [r]=await (this.conn||db).query(this._buildSQL(),this._values); this._reset(); return r[0]?.min||null; } // 🔹 NEW
  async max(col){
    this._select=`MAX(${col}) AS max`; const [r]=await (this.conn||db).query(this._buildSQL(),this._values); this._reset(); return r[0]?.max||null; } // 🔹 NEW

  /*───────────────────────────
  │ EXISTS – boolean cepat 🔹 NEW
  ───────────────────────────*/
  async exists() {
    const clone = this.clone().select('1').limit(1);
    const [r]   = await (clone.conn||db).query(clone._buildSQL(), clone._values);
    return r.length > 0;
  }

  /*───────────────────────────
  │ PLUCK – ambil satu kolom semua baris 🔹 NEW
  ───────────────────────────*/
  async pluck(column) {
    const rows = await this.select(column).get();
    return rows.map(r => r[column]);
  }

  /*───────────────────────────
  │ PAGINATE 
  ───────────────────────────*/
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

  /*───────────────────────────
  │ COUNT / SUM / AVG  / MIN / MAX
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

  /*─────── TRANSACTIONS ──────────
  │ INSERT / BULK INSERT / UPSERT  / UPDATE / DELETE
  ───────────────────────────*/

    /* ---------- INSERT ---------- */
  async insert(data = {}) {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const ph   = cols.map(() => '?').join(', ');
    const sql  = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${ph})`;
    const runner = this.conn || db;
    const [res] = await runner.query(sql, vals);

    // Audit
    await this._logAudit('insert', {
      record_id: res.insertId,
      after: data
    });
    this._reset();
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
    const runner = this.conn || db;
    const [res] = await runner.query(sql, vals);
    return res.affectedRows;      // insert + update rows (MySQL behaviour)
  }


  /* ---------- UPDATE ---------- */
  async update(data = {}) {
    if (!this._wheres) throw new Error('update() membutuhkan where()!');
    // Audit Before
    const before = await this.clone().first();
    //update
    const sql = `UPDATE ${this.table} SET ${Object.keys(data).map(k => `${k}=?`).join(', ')} ${this._wheres}`;
    const vals = [...Object.values(data), ...this._values];
    const runner = this.conn || db;
    const [res] = await runner.query(sql, vals);

    // Audit
    await this._logAudit('update', {
      record_id: before?.id || null,
      before,
      after: { ...before, ...data }
    });

    this._reset();
    return res.affectedRows;
  }

  /* ---------- DELETE ---------- */
  async delete() {
    if (!this._wheres) throw new Error('delete() membutuhkan where()!');
    const before = await this.clone().get();

    const sql = `DELETE FROM ${this.table} ${this._wheres}`;
    const runner = this.conn || db;   
    const [res] = await runner.query(sql, this._values);

    // Audit
    await this._logAudit('delete', {
      record_id: before[0]?.id || null,
      before
    });
    this._reset();
    return res.affectedRows;
  }

  /* ---------- INCREMENT / DECREMENT ---------- */            // 🔹 NEW
  async increment(column, amount = 1) {
    if (!this._wheres) throw new Error('increment() membutuhkan where()!');
    const sql   = `UPDATE ${this.table} SET ${column} = ${column} + ? ${this._wheres}`;
    const vals  = [amount, ...this._values];
    const runner = this.conn || db;
    const [res] = await runner.query(sql, vals);
    this._reset();
    return res.affectedRows;
  }

  async decrement(column, amount = 1) {                        // 🔹 NEW
    return this.increment(column, -amount);
  }

  /*───────────────────────────
  │ AUDIT LOGGING – untuk mencatat perubahan data 🔹 NEW
  ───────────────────────────*/
  enableAudit(table, meta = {}) {
    this._auditTable = table;
    this._auditMeta = meta;
    return this;
  }

  async _logAudit(action, { record_id = null, before = null, after = null } = {}) {
    if (!this._auditTable) return;

    const data = {
      table_name: this.table,
      action,
      record_id,
      before_data: before ? JSON.stringify(before) : null,
      after_data: after ? JSON.stringify(after) : null,
      user_id: this._auditMeta?.userId || null,
      created_at: new Date()
    };

    const cols = Object.keys(data);
    const ph   = cols.map(() => '?').join(', ');
    const sql  = `INSERT INTO ${this._auditTable} (${cols.join(', ')}) VALUES (${ph})`;

    try {
      const runner = this.conn || db;
      await runner.query(sql, Object.values(data));
    } catch (err) {
      // Jika tabel tidak ada, buat audit_log secara otomatis
      if (err.message.includes("doesn't exist") || err.message.includes("ER_NO_SUCH_TABLE")) {
        console.warn('[Audit_log table missing] Creating table...');

        await db.query(`
          CREATE TABLE IF NOT EXISTS ${this._auditTable} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            table_name VARCHAR(50),
            action CHAR(250),
            record_id VARCHAR(36),
            before_data JSON,
            after_data JSON,
            user_id CHAR(36),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Coba simpan ulang setelah berhasil membuat
        const runner = this.conn || db;
        await runner.query(sql, Object.values(data));
      } else {
        console.warn('[Audit_log skipped]', err.message);
      }
    }
  }


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

  /*──────── RESET ─────────*/  
  _reset() {
    this._select = '*';
    this._joins = '';
    this._wheres = '';
    this._groupBy = '';
    this._having = '';
    this._orderBy = '';
    this._limit = '';
    this._auditTable = null;
    this._auditMeta = {};
    this._values = [];
  }
}


module.exports = (table, conn = null) => new Model(table, conn);

