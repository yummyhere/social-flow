import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';

let dbInstance: Database | null = null;
let SQL: SqlJsStatic | null = null;
let isInTransaction = false;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'socialflow.sqlite');

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Clean up any leftover .tmp files from previous crashed saves (e.g., OneDrive EPERM)
  try {
    const tmpFiles = fs.readdirSync(DATA_DIR).filter((f) => f.startsWith('socialflow.sqlite.tmp.'));
    for (const f of tmpFiles) {
      try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch {}
    }
  } catch {}

  SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Run migrations
  const migrationsPath = path.resolve(process.cwd(), 'server', 'migrations.sql');
  if (fs.existsSync(migrationsPath)) {
    const migrationSql = fs.readFileSync(migrationsPath, 'utf8');
    dbInstance.run(migrationSql);
    saveDatabase();
  }

  return dbInstance;
}

export function saveDatabase(): void {
  if (!dbInstance || isInTransaction) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);

  // Attempt atomic rename (safest). Falls back to direct write on OneDrive/locked
  // filesystems where renameSync fails with EPERM because the .tmp file gets locked
  // by the sync client before the rename can complete.
  const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tmpFile, buffer);
    fs.renameSync(tmpFile, DB_FILE);
  } catch {
    // Atomic rename failed — clean up tmp and write directly
    try { fs.unlinkSync(tmpFile); } catch {}
    try {
      fs.writeFileSync(DB_FILE, buffer);
    } catch (writeErr) {
      console.error('[Database] CRITICAL: Failed to save database:', writeErr);
    }
  }
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function get<T = any>(sql: string, params: any[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql: string, params: any[] = []): { changes: number } {
  const db = getDb();
  db.run(sql, params);
  const changes = db.getRowsModified();
  if (!isInTransaction) {
    saveDatabase();
  }
  return { changes };
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  if (isInTransaction) {
    return fn();
  }

  isInTransaction = true;
  db.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    db.run('COMMIT;');
    isInTransaction = false;
    saveDatabase();
    return result;
  } catch (err) {
    isInTransaction = false;
    try {
      db.run('ROLLBACK;');
    } catch {}
    throw err;
  }
}
