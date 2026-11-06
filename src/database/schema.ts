import { type SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      package_quantity REAL NOT NULL,
      package_unit TEXT NOT NULL CHECK(package_unit IN ('g', 'ml', 'un')),
      package_price REAL NOT NULL,
      cost_per_base_unit REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      min_stock_alert INTEGER NOT NULL DEFAULT 5,
      yield_units INTEGER DEFAULT 1,
      unit_production_cost REAL DEFAULT 0.0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS product_recipes (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity_used REAL NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'canceled')),
      payment_method TEXT NOT NULL CHECK(payment_method IN ('pix', 'cash', 'card')),
      total_amount REAL NOT NULL,
      delivery_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS financial_transactions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IN', 'OUT')),
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      origin TEXT NOT NULL CHECK(origin IN ('order', 'production', 'ingredient_purchase', 'manual_adjustment')),
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON financial_transactions(created_at);
  `);
}