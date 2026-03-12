import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { config } from "../config.js";

let prodDb: SqlJsDatabase;
let sandboxDb: SqlJsDatabase;
let SQL: Awaited<ReturnType<typeof initSqlJs>>;

// ----- Global mode: sandbox (default) or live -----
// Persisted to data/mode.txt so it survives restarts.

const modePath = resolve(config.db.path, "..", "mode.txt");

function readGlobalMode(): "sandbox" | "live" {
  if (existsSync(modePath)) {
    const val = readFileSync(modePath, "utf-8").trim();
    if (val === "live") return "live";
  }
  return "sandbox"; // default
}

let globalMode: "sandbox" | "live" = readGlobalMode();

/** Get the current global mode. */
export function getGlobalMode(): "sandbox" | "live" {
  return globalMode;
}

/** Switch to live mode. Persists across restarts. */
export function goLive(): void {
  globalMode = "live";
  writeFileSync(modePath, "live");
}

/** Switch back to sandbox mode. Persists across restarts. */
export function goSandbox(): void {
  globalMode = "sandbox";
  writeFileSync(modePath, "sandbox");
}

/** Route the active DB for this request based on global mode. */
export function setActiveDb(mode: "prod" | "sandbox"): void {
  activeMode = mode;
}

let activeMode: "prod" | "sandbox" = "sandbox";

function getDb(): SqlJsDatabase {
  return activeMode === "sandbox" ? sandboxDb : prodDb;
}

function getDbPath(): string {
  return activeMode === "sandbox" ? config.db.sandboxPath : config.db.path;
}

/** Delete all sandbox data by recreating the sandbox DB. */
export function wipeSandbox(): void {
  sandboxDb.close();
  if (existsSync(config.db.sandboxPath)) {
    unlinkSync(config.db.sandboxPath);
  }
  sandboxDb = new SQL.Database();
  sandboxDb.run("PRAGMA foreign_keys = ON");
  const schema = readFileSync(
    resolve(config.projectRoot, "src", "db", "schema.sql"),
    "utf-8"
  );
  sandboxDb.exec(schema);
  saveTo(sandboxDb, config.db.sandboxPath);

  // Seed sandbox users
  sandboxDb.run(
    "INSERT INTO users (telegram_user_id, name, role) VALUES (?, ?, ?)",
    [config.telegram.jayUserId, "Jay", "principal"]
  );
  sandboxDb.run(
    "INSERT INTO users (telegram_user_id, name, role) VALUES (?, ?, ?)",
    [config.telegram.robertUserId, "Robert", "associate"]
  );
  saveTo(sandboxDb, config.db.sandboxPath);
}

// ----- Initialization -----

/** Initialize both prod and sandbox databases. Must be called before any queries. */
export async function initDb(): Promise<void> {
  SQL = await initSqlJs();

  mkdirSync(dirname(config.db.path), { recursive: true });

  // Prod DB
  if (existsSync(config.db.path)) {
    const buffer = readFileSync(config.db.path);
    prodDb = new SQL.Database(buffer);
  } else {
    prodDb = new SQL.Database();
  }
  prodDb.run("PRAGMA foreign_keys = ON");

  // Sandbox DB
  if (existsSync(config.db.sandboxPath)) {
    const buffer = readFileSync(config.db.sandboxPath);
    sandboxDb = new SQL.Database(buffer);
  } else {
    sandboxDb = new SQL.Database();
  }
  sandboxDb.run("PRAGMA foreign_keys = ON");
}

/** Persist a specific database to disk. */
function saveTo(database: SqlJsDatabase, path: string): void {
  const data = database.export();
  writeFileSync(path, Buffer.from(data));
}

/** Persist the currently active database to disk. */
function save(): void {
  saveTo(getDb(), getDbPath());
}

// ----- Low-level query helpers -----

function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql);
  stmt.bind(params as (string | number | null | Uint8Array)[]);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const results = queryAll<T>(sql, params);
  return results[0];
}

function runSql(sql: string, params: unknown[] = []): number {
  getDb().run(sql, params as (string | number | null | Uint8Array)[]);
  save();
  const result = queryOne<{ id: number }>("SELECT last_insert_rowid() as id");
  return result?.id ?? 0;
}

// ----- Migration -----

/** Run the schema migration on both databases. */
export function migrate(): void {
  const schema = readFileSync(
    resolve(config.projectRoot, "src", "db", "schema.sql"),
    "utf-8"
  );

  // Migrate prod
  prodDb.exec(schema);
  saveTo(prodDb, config.db.path);

  // Migrate sandbox
  sandboxDb.exec(schema);
  saveTo(sandboxDb, config.db.sandboxPath);

  // Seed prod users if empty
  setActiveDb("prod");
  const count = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM users");
  if (!count || count.c === 0) {
    runSql(
      "INSERT INTO users (telegram_user_id, name, role) VALUES (?, ?, ?)",
      [config.telegram.jayUserId, "Jay", "principal"]
    );
    runSql(
      "INSERT INTO users (telegram_user_id, name, role) VALUES (?, ?, ?)",
      [config.telegram.robertUserId, "Robert", "associate"]
    );
    console.log("Seeded users: Jay (principal), Robert (associate)");
  }

  // Seed sandbox users if empty
  setActiveDb("sandbox");
  const sbCount = queryOne<{ c: number }>("SELECT COUNT(*) as c FROM users");
  if (!sbCount || sbCount.c === 0) {
    runSql(
      "INSERT INTO users (telegram_user_id, name, role) VALUES (?, ?, ?)",
      [config.telegram.jayUserId, "Jay", "principal"]
    );
    runSql(
      "INSERT INTO users (telegram_user_id, name, role) VALUES (?, ?, ?)",
      [config.telegram.robertUserId, "Robert", "associate"]
    );
    console.log("Seeded sandbox users");
  }

  // Reset to prod
  setActiveDb("prod");
}

// ----- User helpers -----

export interface DbUser {
  id: number;
  telegram_user_id: number;
  name: string;
  role: "principal" | "associate";
}

export function getUserByTelegramId(telegramId: number): DbUser | undefined {
  return queryOne<DbUser>(
    "SELECT * FROM users WHERE telegram_user_id = ?",
    [telegramId]
  );
}

export function getUserByName(name: string): DbUser | undefined {
  return queryOne<DbUser>(
    "SELECT * FROM users WHERE LOWER(name) = LOWER(?)",
    [name]
  );
}

export function getAllUsers(): DbUser[] {
  return queryAll<DbUser>("SELECT * FROM users");
}

// ----- Task helpers -----

export interface DbTask {
  id: number;
  title: string;
  description: string | null;
  assignee_id: number | null;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  due_date: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export function createTask(task: {
  title: string;
  description?: string;
  assignee_id?: number;
  priority?: string;
  due_date?: string;
  created_by?: number;
}): DbTask {
  const id = runSql(
    `INSERT INTO tasks (title, description, assignee_id, priority, due_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      task.title,
      task.description ?? null,
      task.assignee_id ?? null,
      task.priority ?? "normal",
      task.due_date ?? null,
      task.created_by ?? null,
    ]
  );
  return queryOne<DbTask>("SELECT * FROM tasks WHERE id = ?", [id])!;
}

export function listTasks(
  filters: { assignee_id?: number; status?: string } = {}
): DbTask[] {
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params: unknown[] = [];

  if (filters.assignee_id) {
    sql += " AND assignee_id = ?";
    params.push(filters.assignee_id);
  }
  if (filters.status) {
    sql += " AND status = ?";
    params.push(filters.status);
  } else {
    sql += " AND status IN ('open', 'in_progress')";
  }

  sql +=
    " ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 WHEN 'low' THEN 3 END, created_at DESC";

  return queryAll<DbTask>(sql, params);
}

export function updateTaskStatus(
  taskId: number,
  status: string
): DbTask | undefined {
  runSql(
    "UPDATE tasks SET status = ?, updated_at = datetime('now') WHERE id = ?",
    [status, taskId]
  );
  return queryOne<DbTask>("SELECT * FROM tasks WHERE id = ?", [taskId]);
}

// ----- Expense helpers -----

export interface DbExpense {
  id: number;
  amount: number;
  currency: string;
  vendor: string | null;
  category: string;
  description: string | null;
  receipt_photo_id: string | null;
  mpesa_code: string | null;
  expense_date: string;
  logged_by: number | null;
  created_at: string;
}

export function createExpense(expense: {
  amount: number;
  vendor?: string;
  category?: string;
  description?: string;
  receipt_photo_id?: string;
  mpesa_code?: string;
  expense_date?: string;
  logged_by?: number;
}): DbExpense {
  const id = runSql(
    `INSERT INTO expenses (amount, vendor, category, description, receipt_photo_id, mpesa_code, expense_date, logged_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expense.amount,
      expense.vendor ?? null,
      expense.category ?? "other",
      expense.description ?? null,
      expense.receipt_photo_id ?? null,
      expense.mpesa_code ?? null,
      expense.expense_date ?? new Date().toISOString().split("T")[0],
      expense.logged_by ?? null,
    ]
  );
  return queryOne<DbExpense>("SELECT * FROM expenses WHERE id = ?", [id])!;
}

export function getExpensesByPeriod(
  startDate: string,
  endDate: string
): DbExpense[] {
  return queryAll<DbExpense>(
    "SELECT * FROM expenses WHERE expense_date >= ? AND expense_date <= ? ORDER BY expense_date DESC",
    [startDate, endDate]
  );
}

export function getExpenseSummary(
  startDate: string,
  endDate: string
): { category: string; total: number; count: number }[] {
  return queryAll<{ category: string; total: number; count: number }>(
    `SELECT category, SUM(amount) as total, COUNT(*) as count
     FROM expenses
     WHERE expense_date >= ? AND expense_date <= ?
     GROUP BY category
     ORDER BY total DESC`,
    [startDate, endDate]
  );
}

// ----- Shopping helpers -----

export interface DbShoppingItem {
  id: number;
  item: string;
  quantity: string | null;
  need_by: string | null;
  purchased: number;
  added_by: number | null;
  created_at: string;
}

export function addShoppingItem(item: {
  item: string;
  quantity?: string;
  need_by?: string;
  added_by?: number;
}): DbShoppingItem {
  const id = runSql(
    `INSERT INTO shopping_items (item, quantity, need_by, added_by)
     VALUES (?, ?, ?, ?)`,
    [
      item.item,
      item.quantity ?? null,
      item.need_by ?? null,
      item.added_by ?? null,
    ]
  );
  return queryOne<DbShoppingItem>(
    "SELECT * FROM shopping_items WHERE id = ?",
    [id]
  )!;
}

export function listShoppingItems(showPurchased = false): DbShoppingItem[] {
  const sql = showPurchased
    ? "SELECT * FROM shopping_items ORDER BY purchased ASC, created_at DESC"
    : "SELECT * FROM shopping_items WHERE purchased = 0 ORDER BY created_at DESC";
  return queryAll<DbShoppingItem>(sql);
}

export function markShoppingItemPurchased(
  itemId: number
): DbShoppingItem | undefined {
  runSql("UPDATE shopping_items SET purchased = 1 WHERE id = ?", [itemId]);
  return queryOne<DbShoppingItem>(
    "SELECT * FROM shopping_items WHERE id = ?",
    [itemId]
  );
}

// ----- Note helpers -----

export interface DbNote {
  id: number;
  content: string;
  owner_id: number;
  created_at: string;
}

export function createNote(content: string, ownerId: number): DbNote {
  const id = runSql(
    "INSERT INTO notes (content, owner_id) VALUES (?, ?)",
    [content, ownerId]
  );
  return queryOne<DbNote>("SELECT * FROM notes WHERE id = ?", [id])!;
}

export function listNotes(ownerId: number): DbNote[] {
  return queryAll<DbNote>(
    "SELECT * FROM notes WHERE owner_id = ? ORDER BY created_at DESC",
    [ownerId]
  );
}

export function deleteNote(noteId: number, ownerId: number): boolean {
  runSql("DELETE FROM notes WHERE id = ? AND owner_id = ?", [noteId, ownerId]);
  return true;
}

// ----- Reminder helpers -----

export interface DbReminder {
  id: number;
  message: string;
  target_user_id: number | null;
  cron_expression: string | null;
  next_fire_at: string;
  is_active: number;
  gcal_event_id: string | null;
  created_by: number | null;
  created_at: string;
}

export function createReminder(reminder: {
  message: string;
  target_user_id?: number;
  cron_expression?: string;
  next_fire_at: string;
  created_by?: number;
  gcal_event_id?: string;
}): DbReminder {
  const id = runSql(
    `INSERT INTO reminders (message, target_user_id, cron_expression, next_fire_at, created_by, gcal_event_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      reminder.message,
      reminder.target_user_id ?? null,
      reminder.cron_expression ?? null,
      reminder.next_fire_at,
      reminder.created_by ?? null,
      reminder.gcal_event_id ?? null,
    ]
  );
  return queryOne<DbReminder>("SELECT * FROM reminders WHERE id = ?", [id])!;
}

export function getDueReminders(): DbReminder[] {
  return queryAll<DbReminder>(
    "SELECT * FROM reminders WHERE is_active = 1 AND next_fire_at <= datetime('now')"
  );
}

export function updateReminderNextFire(id: number, nextFireAt: string): void {
  runSql("UPDATE reminders SET next_fire_at = ? WHERE id = ?", [
    nextFireAt,
    id,
  ]);
}

export function deactivateReminder(id: number): void {
  runSql("UPDATE reminders SET is_active = 0 WHERE id = ?", [id]);
}

export function listActiveReminders(): DbReminder[] {
  return queryAll<DbReminder>(
    "SELECT * FROM reminders WHERE is_active = 1 ORDER BY next_fire_at ASC"
  );
}
