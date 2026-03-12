import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import {
  setActiveDb,
  getGlobalMode,
  wipeSandbox,
  createTask,
  listTasks,
  updateTaskStatus,
  createExpense,
  getExpenseSummary,
  addShoppingItem,
  listShoppingItems,
  markShoppingItemPurchased,
  createReminder,
  listActiveReminders,
  deactivateReminder,
  createNote,
  listNotes,
  deleteNote,
  getUserByTelegramId,
} from "../db/client.js";
import { bold } from "../utils/telegram.js";

export const test: Command = {
  name: "test",
  description: "Run diagnostics to verify all bot features work. DM the bot to use this.",
  register(bot: Bot<Context>) {
    bot.command("test", async (ctx_) => {
      const ctx = ctx_ as BotContext;

      if (!ctx.isDM) {
        await ctx.reply("DM me directly to run tests (keeps the group clean).");
        return;
      }

      const userId = ctx.from?.id;
      if (!userId) return;

      await ctx.reply(`🧪 ${bold("Running diagnostics...")}`, {
        parse_mode: "HTML",
      });

      // Always test against sandbox DB, then restore
      const prevMode = getGlobalMode();
      setActiveDb("sandbox");
      wipeSandbox();

      const results: string[] = [];
      let pass = 0;
      let fail = 0;

      function check(name: string, fn: () => boolean) {
        try {
          if (fn()) {
            results.push(`✅ ${name}`);
            pass++;
          } else {
            results.push(`❌ ${name} — returned false`);
            fail++;
          }
        } catch (err) {
          results.push(
            `❌ ${name} — ${err instanceof Error ? err.message : String(err)}`
          );
          fail++;
        }
      }

      check("User lookup", () => {
        const user = getUserByTelegramId(userId);
        return !!user && user.name.length > 0;
      });

      check("Create task", () => {
        const user = getUserByTelegramId(userId);
        const t = createTask({
          title: "Test task: get quotes",
          assignee_id: user?.id,
          created_by: user?.id,
        });
        return t.id > 0 && t.title === "Test task: get quotes";
      });

      check("List tasks", () => listTasks().length > 0);

      check("Complete task", () => {
        const tasks = listTasks();
        const updated = updateTaskStatus(tasks[0].id, "done");
        return updated?.status === "done";
      });

      check("Create expense", () => {
        const user = getUserByTelegramId(userId);
        const e = createExpense({
          amount: 500,
          vendor: "Naivas",
          category: "food",
          description: "Rice and cooking oil",
          logged_by: user?.id,
        });
        return e.id > 0 && e.amount === 500;
      });

      check("Expense summary", () => {
        const summary = getExpenseSummary("2020-01-01", "2030-12-31");
        return summary.length > 0 && summary[0].total === 500;
      });

      check("Add shopping item", () => {
        const user = getUserByTelegramId(userId);
        const item = addShoppingItem({ item: "Rice", quantity: "2kg", added_by: user?.id });
        return item.id > 0 && item.item === "Rice";
      });

      check("List shopping items", () => listShoppingItems().length > 0);

      check("Mark purchased", () => {
        const items = listShoppingItems();
        const updated = markShoppingItemPurchased(items[0].id);
        return updated?.purchased === 1;
      });

      check("Create reminder", () => {
        const user = getUserByTelegramId(userId);
        const r = createReminder({
          message: "Test reminder",
          next_fire_at: new Date(Date.now() + 86400000).toISOString(),
          created_by: user?.id,
        });
        return r.id > 0 && r.is_active === 1;
      });

      check("List reminders", () => listActiveReminders().length > 0);

      check("Deactivate reminder", () => {
        const reminders = listActiveReminders();
        deactivateReminder(reminders[0].id);
        return listActiveReminders().length === 0;
      });

      check("Create note", () => {
        const user = getUserByTelegramId(userId);
        if (!user) return false;
        return createNote("Test private note", user.id).id > 0;
      });

      check("List notes", () => {
        const user = getUserByTelegramId(userId);
        return !!user && listNotes(user.id).length > 0;
      });

      check("Delete note", () => {
        const user = getUserByTelegramId(userId);
        if (!user) return false;
        const notes = listNotes(user.id);
        deleteNote(notes[0].id, user.id);
        return listNotes(user.id).length === 0;
      });

      // Cleanup: wipe sandbox test data, restore previous DB routing
      wipeSandbox();
      setActiveDb(prevMode === "live" ? "prod" : "sandbox");

      const summary = `
🧪 ${bold("Diagnostics Complete")}

${results.join("\n")}

${bold("Result")}: ${pass}/${pass + fail} passed${fail > 0 ? ` (${fail} failed)` : " ✅"}

No real data was touched — tests ran in a temporary sandbox.`;

      await ctx.reply(summary.trim(), { parse_mode: "HTML" });
    });
  },
};
