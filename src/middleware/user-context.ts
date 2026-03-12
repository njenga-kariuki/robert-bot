import type { Context, NextFunction } from "grammy";
import {
  getUserByTelegramId,
  getGlobalMode,
  setActiveDb,
  type DbUser,
} from "../db/client.js";

/**
 * Extended context with user info attached.
 */
export interface BotContext extends Context {
  dbUser?: DbUser;
  /** True if this message is a direct message (not a group chat). Set by middleware. */
  isDM?: boolean;
  /** True if the bot is currently in sandbox/practice mode. Set by middleware. */
  isSandbox?: boolean;
}

/**
 * Looks up the sender in the DB, detects DM vs group,
 * and routes to the correct DB based on global mode.
 */
export async function userContextMiddleware(
  ctx: BotContext,
  next: NextFunction
): Promise<void> {
  const telegramUserId = ctx.from?.id;

  // Detect DM vs group
  ctx.isDM = ctx.chat?.type === "private";

  // Route DB based on global mode (sandbox or live)
  const mode = getGlobalMode();
  ctx.isSandbox = mode === "sandbox";
  setActiveDb(mode === "sandbox" ? "sandbox" : "prod");

  // Look up user in the active DB
  if (telegramUserId) {
    ctx.dbUser = getUserByTelegramId(telegramUserId);
  }

  await next();
}
