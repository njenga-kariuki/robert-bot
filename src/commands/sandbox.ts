import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { goLive, goSandbox, getGlobalMode, wipeSandbox } from "../db/client.js";
import { config } from "../config.js";
import { bold } from "../utils/telegram.js";

export const golive: Command = {
  name: "golive",
  description: "Switch from practice mode to live tracking (Jay only)",
  register(bot: Bot<Context>) {
    bot.command("golive", async (ctx_) => {
      const ctx = ctx_ as BotContext;

      // Jay only
      if (ctx.from?.id !== config.telegram.jayUserId) {
        await ctx.reply("Only Jay can switch modes.");
        return;
      }

      const mode = getGlobalMode();

      if (mode === "live") {
        await ctx.reply(
          `Already live. Use /practice to switch back to practice mode.`
        );
        return;
      }

      goLive();
      await ctx.reply(
        `✅ ${bold("We're live!")} Everything from now on is real — tasks, expenses, shopping, reminders all count.\n\nPractice data is still saved separately if you ever need /practice mode again.`,
        { parse_mode: "HTML" }
      );
    });

    bot.command("practice", async (ctx_) => {
      const ctx = ctx_ as BotContext;

      // Jay only
      if (ctx.from?.id !== config.telegram.jayUserId) {
        await ctx.reply("Only Jay can switch modes.");
        return;
      }

      const mode = getGlobalMode();

      if (mode === "sandbox") {
        await ctx.reply("Already in practice mode. Use /golive when ready.");
        return;
      }

      goSandbox();
      await ctx.reply(
        `🏖 ${bold("Practice mode.")} Everything is safe to experiment with — nothing touches real data.\n\nUse /golive when ready to go back to live.`,
        { parse_mode: "HTML" }
      );
    });

    bot.command("wipe", async (ctx_) => {
      const ctx = ctx_ as BotContext;

      if (ctx.from?.id !== config.telegram.jayUserId) {
        await ctx.reply("Only Jay can wipe practice data.");
        return;
      }

      wipeSandbox();
      await ctx.reply("🧹 Practice data wiped clean.");
    });
  },
};
