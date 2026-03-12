import type { Bot, Context } from "grammy";

export interface Command {
  /** Command name without slash, e.g. "task" */
  name: string;
  /** One-line description for /help and NL classifier */
  description: string;
  /** Example usage shown in /help */
  examples?: string[];
  /** Register command handlers on the bot instance */
  register: (bot: Bot<Context>) => void;
}
