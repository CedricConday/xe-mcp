/**
 * Optional SQLite-backed rate history store.
 * Enabled when RATE_DB_PATH is set in the environment.
 *
 * Schema mirrors what a PostgreSQL production table would look like —
 * the same SQL works on Postgres with minimal changes (replace TEXT PRIMARY KEY
 * composite with a proper PK, NUMERIC for rate precision, TIMESTAMPTZ for timestamps).
 *
 * Usage: query before fetching from Xe/Frankfurter; cache any fetched rates.
 */

import type Database from "better-sqlite3";
import path from "path";

const DDL = `
  CREATE TABLE IF NOT EXISTS rates (
    pair        TEXT NOT NULL,
    rate_date   TEXT NOT NULL,
    rate        REAL NOT NULL,
    source      TEXT NOT NULL,
    fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (pair, rate_date)
  );
  CREATE INDEX IF NOT EXISTS rates_pair_date ON rates(pair, rate_date);
`;

let _db: Database.Database | null = null;

function db(): Database.Database | null {
  const dbPath = process.env.RATE_DB_PATH;
  if (!dbPath) return null;
  if (!_db) {
    // Lazy-load the native module only when the optional SQLite cache is
    // actually enabled. better-sqlite3 is a devDependency, so importing it at
    // module top crashed prod/Docker/Lambda boot ("Cannot find module"). See
    // review 2026-06-29.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require("better-sqlite3") as typeof import("better-sqlite3");
    _db = new Database(path.resolve(dbPath));
    _db.exec(DDL);
  }
  return _db;
}

export function storeCached(): boolean {
  return !!process.env.RATE_DB_PATH;
}

export function getCachedRate(pair: string, date: string): number | null {
  const database = db();
  if (!database) return null;
  const row = database
    .prepare("SELECT rate FROM rates WHERE pair = ? AND rate_date = ?")
    .get(pair, date) as { rate: number } | undefined;
  return row?.rate ?? null;
}

export function setCachedRate(
  pair: string,
  date: string,
  rate: number,
  source: string
): void {
  const database = db();
  if (!database) return;
  database
    .prepare(
      "INSERT OR REPLACE INTO rates (pair, rate_date, rate, source) VALUES (?, ?, ?, ?)"
    )
    .run(pair, date, rate, source);
}

export function getCachedSeries(
  pair: string,
  fromDate: string,
  toDate: string
): Array<{ date: string; rate: number }> {
  const database = db();
  if (!database) return [];
  return database
    .prepare(
      "SELECT rate_date AS date, rate FROM rates WHERE pair = ? AND rate_date BETWEEN ? AND ? ORDER BY rate_date ASC"
    )
    .all(pair, fromDate, toDate) as Array<{ date: string; rate: number }>;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
