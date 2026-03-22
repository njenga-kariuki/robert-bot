import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { extractParams } from "../services/claude.js";
import { createExpense, deleteExpense } from "../db/client.js";
import { bold, formatKES, notifyGroup } from "../utils/telegram.js";
import { nowInTimezone } from "../utils/dates.js";
import { getBotInstance } from "../bot.js";
import { markPracticeStep } from "../services/practice-tracker.js";

interface ExpenseParams {
  amount: number | null;
  vendor: string | null;
  category: "food" | "transport" | "supplies" | "utilities" | "other" | null;
  description: string | null;
  mpesa_code: string | null;
  expense_date: string | null;
}

export const expense: Command = {
  name: "expense",
  description:
    "Log or delete an expense. e.g. /expense 500 rice at Naivas. Or just send a photo of the receipt.",
  examples: ["/expense 500 rice at Naivas", "/expense 1200 uber to Westlands", "/expense delete 3"],
  register(bot: Bot<Context>) {
    bot.command("expense", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const text = ctx.match as string;
      const senderName = ctx.dbUser?.name ?? "Unknown";
      const now = nowInTimezone();

      if (!text.trim()) {
        await ctx.reply(
          "How to log an expense:\n• /expense 500 rice at Naivas\n• Send a photo of the receipt/M-Pesa\n• Or just type: I spent 500 on rice\n• /expense delete [id] — remove an expense"
        );
        return;
      }

      // Quick shortcut: delete/remove
      const lower = text.trim().toLowerCase();
      if (/^(delete|del|remove)\s+\d+/i.test(lower)) {
        const id = parseInt(text.replace(/^(delete|del|remove)\s+/i, "").trim());
        if (!isNaN(id)) {
          const exp = deleteExpense(id);
          if (!exp) {
            await ctx.reply(`Expense #${id} not found.`);
          } else {
            await ctx.reply(`🗑 Deleted expense #${exp.id}: KES ${exp.amount} — ${exp.description ?? exp.category}`);
          }
          return;
        }
      }

      const params = await extractParams<ExpenseParams>(
        "expense",
        text,
        `{
          "amount": "number in KES",
          "vendor": "store/vendor name or null",
          "category": "food|transport|supplies|utilities|other",
          "description": "what was purchased",
          "mpesa_code": "M-Pesa transaction code or null",
          "expense_date": "YYYY-MM-DD or null (default today)"
        }`,
        senderName,
        now.toISOString()
      );

      if (!params.amount) {
        await ctx.reply(
          "I need at least an amount. e.g. /expense 500 rice at Naivas"
        );
        return;
      }

      const exp = createExpense({
        amount: params.amount,
        vendor: params.vendor ?? undefined,
        category: params.category ?? undefined,
        description: params.description ?? undefined,
        mpesa_code: params.mpesa_code ?? undefined,
        expense_date: params.expense_date ?? undefined,
        logged_by: ctx.dbUser?.id,
      });

      const parts = [
        `✅ Expense #${exp.id}: ${bold(formatKES(exp.amount))}`,
      ];
      if (exp.vendor) parts.push(`Vendor: ${exp.vendor}`);
      parts.push(`Category: ${exp.category}`);
      if (exp.description) parts.push(`Description: ${exp.description}`);

      await ctx.reply(parts.join("\n"), { parse_mode: "HTML" });
      await markPracticeStep(ctx, "expense", getBotInstance());

      if (ctx.isDM) {
        await notifyGroup(getBotInstance(), senderName, `💰 Expense #${exp.id}: ${formatKES(exp.amount)} — ${exp.description ?? exp.category} (${exp.category})`);
      }
    });

    // Handle NL-routed expense intents
    bot.on("message:text", async (ctx_, next) => {
      const ctx = ctx_ as BotContext & {
        classifiedIntent?: { intent: string; params: Record<string, unknown> };
        fromNL?: boolean;
      };
      if (!ctx.fromNL || ctx.classifiedIntent?.intent !== "expense") {
        return next();
      }

      const p = ctx.classifiedIntent.params as Partial<ExpenseParams>;
      if (!p.amount) return;

      const exp = createExpense({
        amount: p.amount,
        vendor: p.vendor ?? undefined,
        category: p.category ?? undefined,
        description: p.description ?? undefined,
        logged_by: ctx.dbUser?.id,
      });

      const parts = [
        `✅ Expense #${exp.id}: ${bold(formatKES(exp.amount))}`,
      ];
      if (exp.vendor) parts.push(`Vendor: ${exp.vendor}`);
      parts.push(`Category: ${exp.category}`);
      if (exp.description) parts.push(`Description: ${exp.description}`);

      await ctx.reply(parts.join("\n"), { parse_mode: "HTML" });
      await markPracticeStep(ctx, "expense", getBotInstance());

      if (ctx.isDM) {
        const senderName = ctx.dbUser?.name ?? "Unknown";
        await notifyGroup(getBotInstance(), senderName, `💰 Expense #${exp.id}: ${formatKES(exp.amount)} — ${exp.description ?? exp.category} (${exp.category})`);
      }
    });
  },
};
