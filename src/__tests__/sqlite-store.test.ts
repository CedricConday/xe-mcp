// Tests for the SQLite rate history store — runs against real in-memory SQLite

import Database from "better-sqlite3";

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

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(DDL);
  return db;
}

describe("SQLite rate store schema", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  afterEach(() => {
    db.close();
  });

  test("table is created with correct columns", () => {
    const cols = db.prepare("PRAGMA table_info(rates)").all() as Array<{ name: string; type: string; pk: number }>;
    const names = cols.map((c) => c.name);
    expect(names).toContain("pair");
    expect(names).toContain("rate_date");
    expect(names).toContain("rate");
    expect(names).toContain("source");
    expect(names).toContain("fetched_at");
  });

  test("composite primary key prevents duplicate (pair, date) entries", () => {
    const insert = db.prepare("INSERT INTO rates (pair, rate_date, rate, source) VALUES (?, ?, ?, ?)");
    insert.run("NZDUSD", "2026-06-26", 0.56494, "frankfurter");
    expect(() => insert.run("NZDUSD", "2026-06-26", 0.56500, "frankfurter")).toThrow();
  });

  test("INSERT OR REPLACE upserts correctly", () => {
    db.prepare("INSERT OR REPLACE INTO rates (pair, rate_date, rate, source) VALUES (?, ?, ?, ?)").run("NZDUSD", "2026-06-26", 0.56494, "frankfurter");
    db.prepare("INSERT OR REPLACE INTO rates (pair, rate_date, rate, source) VALUES (?, ?, ?, ?)").run("NZDUSD", "2026-06-26", 0.56500, "xe");
    const row = db.prepare("SELECT rate, source FROM rates WHERE pair = ? AND rate_date = ?").get("NZDUSD", "2026-06-26") as { rate: number; source: string };
    expect(row.rate).toBeCloseTo(0.565, 3);
    expect(row.source).toBe("xe");
  });
});

describe("SQLite rate store queries", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
    const insert = db.prepare("INSERT INTO rates (pair, rate_date, rate, source) VALUES (?, ?, ?, ?)");
    insert.run("NZDUSD", "2026-06-24", 0.5643, "frankfurter");
    insert.run("NZDUSD", "2026-06-25", 0.5639, "frankfurter");
    insert.run("NZDUSD", "2026-06-26", 0.5649, "frankfurter");
    insert.run("AUDUSD", "2026-06-26", 0.6521, "frankfurter");
  });

  afterEach(() => {
    db.close();
  });

  test("SELECT by pair and date returns correct rate", () => {
    const row = db.prepare("SELECT rate FROM rates WHERE pair = ? AND rate_date = ?").get("NZDUSD", "2026-06-26") as { rate: number };
    expect(row.rate).toBeCloseTo(0.5649, 4);
  });

  test("BETWEEN query returns ordered series", () => {
    const rows = db.prepare(
      "SELECT rate_date AS date, rate FROM rates WHERE pair = ? AND rate_date BETWEEN ? AND ? ORDER BY rate_date ASC"
    ).all("NZDUSD", "2026-06-24", "2026-06-26") as Array<{ date: string; rate: number }>;
    expect(rows).toHaveLength(3);
    expect(rows[0].date).toBe("2026-06-24");
    expect(rows[2].date).toBe("2026-06-26");
  });

  test("different pairs are isolated", () => {
    const nzd = db.prepare("SELECT COUNT(*) as cnt FROM rates WHERE pair = 'NZDUSD'").get() as { cnt: number };
    const aud = db.prepare("SELECT COUNT(*) as cnt FROM rates WHERE pair = 'AUDUSD'").get() as { cnt: number };
    expect(nzd.cnt).toBe(3);
    expect(aud.cnt).toBe(1);
  });

  test("missing (pair, date) returns undefined", () => {
    const row = db.prepare("SELECT rate FROM rates WHERE pair = ? AND rate_date = ?").get("NZDUSD", "2026-01-01");
    expect(row).toBeUndefined();
  });

  test("index exists on (pair, rate_date)", () => {
    const indexes = db.prepare("PRAGMA index_list(rates)").all() as Array<{ name: string }>;
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("rates_pair_date");
  });
});
