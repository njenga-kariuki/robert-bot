import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { bold } from "../utils/telegram.js";

export const ready: Command = {
  name: "ready",
  description: "Signal that you've finished the guide and are ready to go live",
  register(bot: Bot<Context>) {
    bot.command("ready", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const name = ctx.dbUser?.name ?? ctx.from?.first_name ?? "Someone";

      await ctx.reply(
        `${bold(`${name} is ready to go live!`)} 🚀\n\nJay — when you're good too, send /golive and everything starts counting for real.`,
        { parse_mode: "HTML" }
      );
    });
  },
};
