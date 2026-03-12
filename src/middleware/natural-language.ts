import type { NextFunction } from "grammy";
import type { BotContext } from "./user-context.js";
import { classifyIntent, dmResearchQuery } from "../services/claude.js";
import type { Command } from "../commands/types.js";

let registeredCommands: Command[] = [];

/**
 * Set the command registry for NL classification.
 * Called once during bot setup.
 */
export function setCommandRegistry(commands: Command[]): void {
  registeredCommands = commands;
}

/**
 * Natural language fallback middleware.
 *
 * Behavior differs by channel:
 * - Group chat: Classify intent, only act if confidence > 0.7 (avoid interrupting casual chat)
 * - DM: Classify intent first. If it matches a command, route there.
 *   If not, treat it as a research/general question and answer via Claude.
 */
export async function naturalLanguageMiddleware(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  const text = ctx.message?.text;
  if (!text || text.startsWith("/") || ctx.message?.photo) {
    await next();
    return;
  }

  const senderName = ctx.dbUser?.name ?? ctx.from?.first_name ?? "Unknown";
  const isDM = ctx.isDM;

  try {
    // Try to classify as a bot command first
    const intent = await classifyIntent(
      text,
      registeredCommands,
      senderName
    );

    if (intent) {
      // High-confidence command match — route to handler
      (ctx as unknown as Record<string, unknown>).classifiedIntent = intent;
      (ctx as unknown as Record<string, unknown>).fromNL = true;
      await next();
      return;
    }

    // No command match
    if (isDM) {
      // In DMs, treat unmatched messages as research questions
      await ctx.replyWithChatAction("typing");
      const answer = await dmResearchQuery(text, senderName);
      await ctx.reply(answer, { parse_mode: "HTML" });
    }

    // In group chat, stay silent (don't interrupt casual conversation)
  } catch (err) {
    console.error("NL classification error:", err);
    // In DMs, let the user know something went wrong
    if (isDM) {
      await ctx.reply("Sorry, I hit an error processing that. Try again?");
    }
  }
}
