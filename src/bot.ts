import { Bot } from "grammy";
import { config } from "./config.js";
import { commands } from "./commands/index.js";
import { authMiddleware } from "./middleware/auth.js";
import { userContextMiddleware } from "./middleware/user-context.js";
import {
  naturalLanguageMiddleware,
  setCommandRegistry,
} from "./middleware/natural-language.js";
import {
  handlePhoto,
  handlePendingDetail,
  registerReceiptCallbacks,
} from "./services/receipt-parser.js";
import type { BotContext } from "./middleware/user-context.js";

let botInstance: Bot;

export function getBotInstance(): Bot {
  return botInstance;
}

export function createBot(): Bot {
  const bot = new Bot(config.telegram.botToken);
  botInstance = bot;

  // ----- Middleware chain -----

  // 1. Auth: silently drop messages from unknown chats
  bot.use(authMiddleware);

  // 2. User context: attach DB user, detect DM, route sandbox DB
  bot.use(userContextMiddleware);

  // ----- Command registration -----

  for (const cmd of commands) {
    cmd.register(bot);
  }

  // ----- Photo handler -----

  bot.on("message:photo", async (ctx) => {
    await handlePhoto(ctx as BotContext);
  });

  // Receipt confirmation callbacks (inline keyboard buttons)
  registerReceiptCallbacks(bot);

  // ----- Natural language fallback -----

  setCommandRegistry(commands);

  bot.on("message:text", async (ctx, next) => {
    // Skip slash commands (already handled above)
    if (ctx.message.text.startsWith("/")) return;

    // Check if this is a follow-up providing receipt details
    if (handlePendingDetail(ctx as BotContext)) return;

    // Otherwise, try NL intent classification
    await naturalLanguageMiddleware(ctx as BotContext, next);
  });

  // ----- Error handling -----

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
