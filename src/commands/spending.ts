import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import {
  getExpensesByPeriod,
  getExpenseSummary,
} from "../db/client.js";
import { bold, formatKES } from "../utils/telegram.js";
import { parsePeriod, formatDate } from "../utils/dates.js";

export const spending: Command = {
  name: "spending",
  description:
    "View expense summary for a period. e.g. /spending this week, /spending March",
  examples: ["/spending this week", "/spending March", "/spending last month"],
  register(bot: Bot<Context>) {
    bot.command("spending", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const text = (ctx.match as string).trim() || "this month";

      const { start, end, label } = parsePeriod(text);
      const summary = getExpenseSummary(start, end);
      const expenses = getExpensesByPeriod(start, end);

      if (summary.length === 0) {
        await ctx.reply(`No expenses found for ${label}.`);
        return;
      }

      const total = summary.reduce((sum, s) => sum + s.total, 0);

      const lines = [
        `📊 ${bold("Spending: " + label)}`,
        `${start} → ${end}`,
        "",
        bold("By category:"),
      ];

      for (const s of summary) {
        const pct = Math.round((s.total / total) * 100);
        lines.push(`  ${s.category}: ${formatKES(s.total)} (${s.count} items, ${pct}%)`);
      }

      lines.push("", `${bold("Total")}: ${formatKES(total)}`);

      // Show recent items (last 5)
      if (expenses.length > 0) {
        lines.push("", bold("Recent:"));
        const recent = expenses.slice(0, 5);
        for (const e of recent) {
          const desc = e.vendor || e.description || "—";
          lines.push(
            `  ${formatDate(e.expense_date)} · ${formatKES(e.amount)} · ${desc}`
          );
        }
        if (expenses.length > 5) {
          lines.push(`  ...and ${expenses.length - 5} more`);
        }
      }

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
    });
  },
};
