import type { NextFunction } from "grammy";
import type { BotContext } from "./user-context.js";
import {
  classifyIntent,
  dmResearchQuery,
  groupClarifyQuery,
} from "../services/claude.js";
import {
  storeChatMessage,
  getChatHistory,
  getOperationalContext,
} from "../db/client.js";
import type { Command } from "../commands/types.js";
import { markdownToTelegramHtml } from "../utils/telegram.js";
import { markPracticeStep } from "../services/practice-tracker.js";
import { getBotInstance } from "../bot.js";

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
 * Three confidence bands:
 * - > 0.7: Execute command directly
 * - 0.4–0.7: Ask for clarification (both DM and group)
 * - < 0.4 or "ignore": DM → research assistant; Group → stay silent
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
  const chatId = ctx.chat?.id;
  const telegramUserId = ctx.from?.id ?? 0;

  if (!chatId) {
    await next();
    return;
  }

  // Track group messages in sandbox for practice progress
  if (!isDM && ctx.isSandbox) {
    await markPracticeStep(ctx, "group_message", getBotInstance());
  }

  try {
    // Get conversation history from DB
    const dbHistory = getChatHistory(chatId);
    const history = dbHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Store user message
    storeChatMessage(chatId, telegramUserId, "user", text);

    // Classify intent with conversation history
    const intent = await classifyIntent(
      text,
      registeredCommands,
      senderName,
      history
    );

    if (intent && intent.intent !== "ignore" && intent.confidence > 0.7) {
      // High confidence — route to command handler
      // Wrap ctx.reply to capture the response for chat history
      const originalReply = ctx.reply.bind(ctx);
      ctx.reply = async (text: string, other?: unknown) => {
        const result = await originalReply(text, other as Parameters<typeof originalReply>[1]);
        // Strip HTML tags for clean history storage
        const plain = typeof text === "string"
          ? text.replace(/<[^>]+>/g, "")
          : String(text);
        storeChatMessage(chatId, 0, "assistant", plain);
        return result;
      };
      (ctx as unknown as Record<string, unknown>).classifiedIntent = intent;
      (ctx as unknown as Record<string, unknown>).fromNL = true;
      await next();
      return;
    }

    if (
      intent &&
      intent.intent !== "ignore" &&
      intent.confidence >= 0.4 &&
      intent.confidence <= 0.7
    ) {
      // Medium confidence — ask for clarification
      await ctx.replyWithChatAction("typing");
      const clarification = await groupClarifyQuery(text, intent, history);
      await ctx.reply(clarification);
      storeChatMessage(chatId, 0, "assistant", clarification);
      return;
    }

    // Low confidence or "ignore"
    if (isDM) {
      // Research assistant with history + operational context
      await ctx.replyWithChatAction("typing");
      const opsContext = getOperationalContext();
      const rawAnswer = await dmResearchQuery(text, senderName, history, opsContext);
      const answer = markdownToTelegramHtml(rawAnswer);
      await ctx.reply(answer, { parse_mode: "HTML" });
      storeChatMessage(chatId, 0, "assistant", rawAnswer);
      await markPracticeStep(ctx, "dm_research", getBotInstance());
    }

    // In group chat, stay silent
  } catch (err) {
    console.error("NL classification error:", err);
    if (isDM) {
      await ctx.reply("Sorry, I hit an error processing that. Try again?");
    }
  }
}
