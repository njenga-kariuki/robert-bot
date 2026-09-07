import type { Context, NextFunction } from "grammy";
import { config } from "../config.js";

const allowedChatIds = new Set([
  config.telegram.groupChatId,
  config.telegram.jayUserId,
  config.telegram.robertUserId,
]);

/**
 * Silently drops messages from unknown chats/users.
 * Allows: the shared group + direct messages from Njenga or Robert.
 */
export async function authMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId || !allowedChatIds.has(chatId)) {
    // Silent 200 -- don't reveal the bot exists to strangers
    return;
  }
  await next();
}
