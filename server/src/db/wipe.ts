import type { Db } from './database.ts';

/**
 * Drops every table (and with them their indexes) so migrations and the demo seed can
 * start from nothing. Works the same on the local SQLite file and on Turso.
 *
 * Tables are dropped repeatedly until none are left, because a table that other tables
 * still reference by foreign key can only go after them.
 */
export async function dropAllTables(db: Db): Promise<string[]> {
  const dropped: string[] = [];
  for (let round = 0; round < 20; round++) {
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' AND name NOT LIKE 'libsql_%'",
    );
    if (tables.length === 0) return dropped;
    let progress = false;
    for (const { name } of tables) {
      try {
        await db.run(`DROP TABLE IF EXISTS "${name.replace(/"/g, '""')}"`);
        dropped.push(name);
        progress = true;
      } catch {
        // Still referenced by another table; try again next round.
      }
    }
    if (!progress) throw new Error(`Could not drop tables: ${tables.map((t) => t.name).join(', ')}`);
  }
  throw new Error('Gave up dropping tables after 20 rounds');
}
