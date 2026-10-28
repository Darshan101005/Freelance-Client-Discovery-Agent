// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(), owner: text('owner').notNull(),
  data: text('data').notNull(), updated: integer('updated').notNull(),
  revision: integer('revision').notNull().default(0), lockedUntil: integer('locked_until').notNull().default(0),
});
export const userSettings=sqliteTable('user_settings',{
 owner:text('owner').primaryKey(), data:text('data').notNull(), updated:integer('updated').notNull(),
});
