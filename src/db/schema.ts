import { pgTable, serial, text, numeric, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// 1. Users Table (Auth)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(), // login bisa pakai username atau email
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("kasir"), // "admin" | "kasir"
  isApproved: boolean("is_approved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Better Auth Sessions Table
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

// 2. Ingredients Table (Gudang)
export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // "kg", "gram", "liter", "pcs"
  price: numeric("price", { precision: 12, scale: 2 }).notNull(), // harga per satuan
  stock: numeric("stock", { precision: 12, scale: 3 }).notNull().default("0"),
  minStock: numeric("min_stock", { precision: 12, scale: 3 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true), // soft-delete
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 3. Products Table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull(), // harga jual per porsi
  yieldQty: numeric("yield_qty", { precision: 12, scale: 3 }).notNull(), // batch yield quantity
  isActive: boolean("is_active").notNull().default(true), // soft-delete
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 4. Product Recipes Table (Many-to-Many products <-> ingredients)
export const productRecipes = pgTable("product_recipes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(), // qty per 1 batch resep
});

// 5. Order Counters Table (atomic sequence generator)
export const orderCounters = pgTable("order_counters", {
  dateKey: text("date_key").primaryKey(), // format: "YYYYMMDD"
  lastSeq: integer("last_seq").notNull().default(0),
});

// 6. Orders Table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // INV-YYYYMMDD-seq
  date: timestamp("date").notNull().defaultNow(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  serviceChargeAmount: numeric("service_charge_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  revenueTotal: numeric("revenue_total", { precision: 12, scale: 2 }).notNull(),
  roundingAdjustment: numeric("rounding_adjustment", { precision: 12, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull().default("0"),
  hppTotal: numeric("hpp_total", { precision: 12, scale: 2 }).notNull(),
  profitTotal: numeric("profit_total", { precision: 12, scale: 2 }).notNull(), // revenueTotal - hppTotal
  paymentMethod: text("payment_method").notNull(), // cash / qris / transfer
  amountReceived: numeric("amount_received", { precision: 12, scale: 2 }), // khusus cash
  changeAmount: numeric("change_amount", { precision: 12, scale: 2 }), // khusus cash
  customerName: text("customer_name"),
  status: text("status").notNull().default("paid"), // paid / cancelled
  cashierId: integer("cashier_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 7. Order Items Table
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id), // nullable in case product is soft-deleted
  productName: text("product_name").notNull(), // snapshot name
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
  hppPerUnit: numeric("hpp_per_unit", { precision: 12, scale: 2 }).notNull(), // snapshot HPP per unit at order time
  hppTotal: numeric("hpp_total", { precision: 12, scale: 2 }).notNull(),
  sellPrice: numeric("sell_price", { precision: 12, scale: 2 }).notNull(), // snapshot sell price
  revenueTotal: numeric("revenue_total", { precision: 12, scale: 2 }).notNull(),
});

// 8. Stock Movements Table (Audit Trail)
export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
  type: text("type").notNull(), // 'restock' | 'order' | 'adjustment' | 'return'
  qty: numeric("qty", { precision: 12, scale: 3 }).notNull(), // positive for additions, negative for deductions
  refId: text("ref_id"), // orderNumber for order/return, null for manual restock/adjustment
  reason: text("reason"), // 'waste', 'expired', 'correction', etc. for adjustment
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations definitions (Optional but helpful for typed queries)
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orders: many(orders),
  stockMovements: many(stockMovements),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  recipes: many(productRecipes),
  movements: many(stockMovements),
}));

export const productsRelations = relations(products, ({ many }) => ({
  recipes: many(productRecipes),
  orderItems: many(orderItems),
}));

export const productRecipesRelations = relations(productRecipes, ({ one }) => ({
  product: one(products, {
    fields: [productRecipes.productId],
    references: [products.id],
  }),
  ingredient: one(ingredients, {
    fields: [productRecipes.ingredientId],
    references: [ingredients.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  cashier: one(users, {
    fields: [orders.cashierId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  ingredient: one(ingredients, {
    fields: [stockMovements.ingredientId],
    references: [ingredients.id],
  }),
  user: one(users, {
    fields: [stockMovements.userId],
    references: [users.id],
  }),
}));

// 10. Business Settings Table (Singleton)
export const businessSettings = pgTable("business_settings", {
  id: serial("id").primaryKey(),
  businessName: text("business_name").notNull().default("My Business"),
  address: text("address"),
  phone: text("phone"),
  logoUrl: text("logo_url"), // For base64 or external url
  receiptFooterNote: text("receipt_footer_note"),
  taxEnabled: boolean("tax_enabled").notNull().default(false),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  serviceChargeEnabled: boolean("service_charge_enabled").notNull().default(false),
  serviceChargePercent: numeric("service_charge_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  currencySymbol: text("currency_symbol").notNull().default("Rp"),
  defaultReceiptSize: text("default_receipt_size").notNull().default("58mm"),
  roundingEnabled: boolean("rounding_enabled").notNull().default(false),
  roundingNearest: numeric("rounding_nearest", { precision: 10, scale: 2 }).notNull().default("100"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});



// 12. Cash Transactions Table (Ledger Arus Kas — menggantikan expenses)
export const cashTransactions = pgTable("cash_transactions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'in' | 'out'
  category: text("category").notNull(), // 'Penjualan', 'Gaji', 'Sewa', etc.
  isOperational: boolean("is_operational").notNull().default(true), // true: affects P&L, false: balance sheet only
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  note: text("note"),
  sourceType: text("source_type").notNull().default("manual"), // 'manual' | 'order' | 'restock' | 'profit_allocation'
  sourceRefId: text("source_ref_id"), // orderNumber or stock_movements.id or profit_allocations.id
  pocketId: integer("pocket_id").references(() => cashPockets.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});



// 14. Profit Allocations (histori eksekusi alokasi per periode)
export const profitAllocations = pgTable("profit_allocations", {
  id: serial("id").primaryKey(),
  periodStart: text("period_start").notNull(), // ISO date string
  periodEnd: text("period_end").notNull(),
  netProfit: numeric("net_profit", { precision: 12, scale: 2 }).notNull(), // snapshot Laba Bersih
  status: text("status").notNull().default("confirmed"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 15. Profit Allocation Items (breakdown per kategori per eksekusi)
export const profitAllocationItems = pgTable("profit_allocation_items", {
  id: serial("id").primaryKey(),
  profitAllocationId: integer("profit_allocation_id").notNull().references(() => profitAllocations.id, { onDelete: "cascade" }),
  label: text("label").notNull(), // snapshot label
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(), // snapshot %
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), // netProfit * percentage / 100
  isRetained: boolean("is_retained").notNull(), // snapshot
});

// 16. Cash Pockets Table (Kantong Kas)
export const cashPockets = pgTable("cash_pockets", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  type: text("type").notNull(), // 'cost' | 'profit_share'
  percentage: numeric("percentage", { precision: 5, scale: 2 }), // only for type='profit_share'
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// 17. Pocket Transactions Table
export const pocketTransactions = pgTable("pocket_transactions", {
  id: serial("id").primaryKey(),
  pocketId: integer("pocket_id").notNull().references(() => cashPockets.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // 'credit' | 'debit'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  sourceType: text("source_type").notNull(), // 'order' | 'cash_transaction' | 'manual_adjustment'
  sourceRefId: text("source_ref_id"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cashPocketsRelations = relations(cashPockets, ({ many }) => ({
  transactions: many(pocketTransactions),
}));

export const pocketTransactionsRelations = relations(pocketTransactions, ({ one }) => ({
  pocket: one(cashPockets, {
    fields: [pocketTransactions.pocketId],
    references: [cashPockets.id],
  }),
}));
