import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import { lookupQuery } from "../services/claude.js";
import { markdownToTelegramHtml } from "../utils/telegram.js";

export const lookup: Command = {
  name: "lookup",
  description:
    "Look up Nairobi-related info — business hours, locations, prices. e.g. /lookup Java House Westlands hours",
  examples: [
    "/lookup Java House Westlands hours",
    "/lookup best price for 20kg gas cylinder Nairobi",
  ],
  register(bot: Bot<Context>) {
    bot.command("lookup", async (ctx) => {
      const query = (ctx.match as string).trim();

      if (!query) {
        await ctx.reply("What do you want to look up? e.g. /lookup Java House Westlands hours");
        return;
      }

      await ctx.replyWithChatAction("typing");

      const rawAnswer = await lookupQuery(query);
      await ctx.reply(markdownToTelegramHtml(rawAnswer), { parse_mode: "HTML" });
    });
  },
};
