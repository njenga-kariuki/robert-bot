import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import {
  listTasks,
  listActiveReminders,
  listShoppingItems,
  getExpenseSummary,
} from "../db/client.js";
import { bold, formatKES } from "../utils/telegram.js";
import { formatDate, nowInTimezone, toISODate } from "../utils/dates.js";

export const status: Command = {
  name: "status",
  description: "Quick overview — open tasks, upcoming reminders, recent spending, shopping list",
  register(bot: Bot<Context>) {
    bot.command("status", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const now = nowInTimezone();
      const today = toISODate(now);
      const startOfMonth = toISODate(
        new Date(now.getFullYear(), now.getMonth(), 1)
      );

      const lines: string[] = [`📊 ${bold("Status Dashboard")}`, ""];

      // Open tasks
      const tasks = listTasks();
      lines.push(`${bold("Tasks")} (${tasks.length} open)`);
      if (tasks.length > 0) {
        for (const t of tasks.slice(0, 5)) {
          const due = t.due_date ? ` — due ${formatDate(t.due_date)}` : "";
          lines.push(`  #${t.id} ${t.title}${due}`);
        }
        if (tasks.length > 5) lines.push(`  ...and ${tasks.length - 5} more`);
      } else {
        lines.push("  All clear! 🎉");
      }

      lines.push("");

      // Upcoming reminders
      const reminders = listActiveReminders().slice(0, 3);
      lines.push(`${bold("Upcoming Reminders")} (${reminders.length})`);
      if (reminders.length > 0) {
        for (const r of reminders) {
          const recurring = r.cron_expression ? " 🔁" : "";
          lines.push(
            `  ${formatDate(r.next_fire_at, { includeTime: true })} — ${r.message}${recurring}`
          );
        }
      } else {
        lines.push("  None scheduled");
      }

      lines.push("");

      // This month's spending
      const spending = getExpenseSummary(startOfMonth, today);
      const total = spending.reduce((sum, s) => sum + s.total, 0);
      const itemCount = spending.reduce((sum, s) => sum + s.count, 0);
      lines.push(`${bold("Spending This Month")}`);
      if (total > 0) {
        lines.push(`  ${formatKES(total)} across ${itemCount} expenses`);
        for (const s of spending) {
          lines.push(`  ${s.category}: ${formatKES(s.total)}`);
        }
      } else {
        lines.push("  No expenses logged");
      }

      lines.push("");

      // Shopping list
      const shopItems = listShoppingItems();
      lines.push(`${bold("Shopping List")} (${shopItems.length} items)`);
      if (shopItems.length > 0) {
        for (const item of shopItems.slice(0, 5)) {
          const qty = item.quantity ? `${item.quantity} ` : "";
          lines.push(`  ☐ ${qty}${item.item}`);
        }
        if (shopItems.length > 5)
          lines.push(`  ...and ${shopItems.length - 5} more`);
      } else {
        lines.push("  Empty");
      }

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    });
  },
};
