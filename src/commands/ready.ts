import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { bold, notifyGroup } from "../utils/telegram.js";
import { getBotInstance } from "../bot.js";
import { getPracticeProgress, STEP_LABELS } from "../services/practice-tracker.js";

export const ready: Command = {
  name: "ready",
  description: "Signal that you've finished the guide and are ready to go live",
  register(bot: Bot<Context>) {
    bot.command("ready", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const name = ctx.dbUser?.name ?? ctx.from?.first_name ?? "Someone";
      const userId = ctx.from?.id ?? 0;

      // In sandbox mode, check practice progress
      if (ctx.isSandbox) {
        const { remaining, done, total } = getPracticeProgress(userId);

        if (remaining.length > 0) {
          const stepList = remaining
            .map((s) => `  ☐ ${STEP_LABELS[s]}`)
            .join("\n");
          await ctx.reply(
            `Almost there! ${done}/${total} practice steps done.\n\nStill to go:\n${stepList}\n\nThe bot will let you know when you've finished all ${total}.`
          );
          return;
        }
      }

      await ctx.reply(
        `${bold(`${name} is ready to go live!`)} 🚀\n\nJay — when you're good too, send /golive and everything starts counting for real.`,
        { parse_mode: "HTML" }
      );

      if (ctx.isDM) {
        await notifyGroup(getBotInstance(), name, `${name} is ready to go live! 🚀`);
      }
    });
  },
};
