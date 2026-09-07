import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { bold } from "../utils/telegram.js";

export const help: Command = {
  name: "help",
  description: "Show available commands",
  register(bot: Bot<Context>) {
    bot.command("help", async (ctx_) => {
      const ctx = ctx_ as BotContext;

      const modeTag = ctx.isSandbox
        ? "\n🏖 <i>Practice mode — nothing here is real yet</i>\n"
        : "";

      const text = `${bold("Robert Bot")}
${modeTag}
${bold("Tasks")}
/task [who] [what] [by when]
/task list — open tasks
/task done [id] — mark complete

${bold("Expenses")}
/expense [amount] [what]
📷 Send a photo — auto-reads receipts
/spending [period] — summary

${bold("Shopping")}
/shop add [items]
/shop — view list
/shop done [id] — mark purchased

${bold("Reminders")}
/remind [who] [what] [when]
/standing [schedule] [what]

${bold("Other")}
/lookup [question] — quick info
/status — dashboard
/note [text] — personal note (DM)
/guide — walkthrough
/test — run diagnostics (DM)

💡 Or just type naturally — the bot understands.
💡 If it's not sure, it'll ask to confirm first.
💡 DM the bot for private notes and research.`;

      await ctx.reply(text, { parse_mode: "HTML" });
    });

    bot.command("start", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const name = ctx.dbUser?.name ?? ctx.from?.first_name ?? "there";

      const msg = ctx.isDM
        ? `Hey ${name}! 👋 This is your personal space.\n\nYou can:\n• Ask me anything — research, prices, how-to\n• Ask about your tasks, expenses, or shopping list\n• Save notes with /note\n• Use all the same commands as the group\n\nI remember our conversation, so you can follow up naturally. Just type what you need.`
        : `Hey ${name}! 👋 I help you and ${ctx.dbUser?.role === "principal" ? "Robert" : "Njenga"} stay on top of tasks, expenses, shopping, and reminders.\n\nType /guide for a walkthrough, or /help for the command list.`;

      await ctx.reply(msg, { parse_mode: "HTML" });
    });
  },
};
