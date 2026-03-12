import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { extractParams } from "../services/claude.js";
import {
  createReminder,
  listActiveReminders,
  deactivateReminder,
  getUserByName,
} from "../db/client.js";
import { bold } from "../utils/telegram.js";
import { formatDate, nowInTimezone } from "../utils/dates.js";
import CronExpressionParser from "cron-parser";

interface StandingParams {
  action: "add" | "list" | "cancel";
  target: "Jay" | "Robert" | "both" | null;
  message: string | null;
  cron_expression: string | null;
  schedule_description: string | null;
  reminder_id: number | null;
}

export const standing: Command = {
  name: "standing",
  description:
    "Set a recurring reminder. e.g. /standing every Friday 3pm expense review",
  examples: [
    "/standing every Friday 3pm expense review",
    "/standing daily 9am morning check-in",
    "/standing list",
    "/standing cancel 5",
  ],
  register(bot: Bot<Context>) {
    bot.command("standing", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const text = (ctx.match as string).trim();
      const senderName = ctx.dbUser?.name ?? "Unknown";
      const now = nowInTimezone();

      if (!text) {
        return await showStandingReminders(ctx);
      }

      const lower = text.toLowerCase();
      if (lower === "list") {
        return await showStandingReminders(ctx);
      }

      if (lower.startsWith("cancel ") || lower.startsWith("stop ")) {
        const id = parseInt(text.replace(/^(cancel|stop)\s+/i, "").trim());
        if (!isNaN(id)) return await cancelStanding(ctx, id);
      }

      const params = await extractParams<StandingParams>(
        "standing",
        text,
        `{
          "action": "add|list|cancel",
          "target": "Jay|Robert|both|null (who to remind)",
          "message": "the recurring reminder message",
          "cron_expression": "cron expression (e.g. '0 15 * * 5' for every Friday 3pm, '0 9 * * *' for daily 9am). Use Africa/Nairobi timezone.",
          "schedule_description": "human-readable schedule like 'every Friday 3pm' or 'daily 9am'",
          "reminder_id": "number or null (for cancel)"
        }`,
        senderName,
        now.toISOString()
      );

      if (params.action === "list") {
        return await showStandingReminders(ctx);
      }

      if (params.action === "cancel" && params.reminder_id) {
        return await cancelStanding(ctx, params.reminder_id);
      }

      if (!params.message || !params.cron_expression) {
        await ctx.reply(
          "Set a recurring reminder:\n/standing [schedule] [message]\n\nExample: /standing every Friday 3pm expense review"
        );
        return;
      }

      const cronExpr = params.cron_expression;

      // Compute next fire time from cron
      let nextFire: string;
      try {
        const interval = CronExpressionParser.parse(cronExpr, {
          tz: "Africa/Nairobi",
        });
        nextFire = interval.next().toISOString() as string;
      } catch {
        await ctx.reply(
          "I couldn't parse that schedule. Try something like: every Friday 3pm, daily 9am, every Monday and Thursday 10am"
        );
        return;
      }

      let targetUserId: number | undefined;
      let targetLabel = "everyone";
      if (params.target && params.target !== "both") {
        const user = getUserByName(params.target);
        if (user) {
          targetUserId = user.id;
          targetLabel = user.name;
        }
      }

      const reminder = createReminder({
        message: params.message,
        target_user_id: targetUserId,
        cron_expression: params.cron_expression,
        next_fire_at: nextFire,
        created_by: ctx.dbUser?.id,
      });

      const schedule = params.schedule_description ?? params.cron_expression;
      const parts = [
        `🔁 Standing reminder #${reminder.id}`,
        `For: ${bold(targetLabel)}`,
        `Schedule: ${schedule}`,
        `Message: ${params.message}`,
        `Next: ${formatDate(nextFire, { includeTime: true })}`,
      ];

      await ctx.reply(parts.join("\n"), { parse_mode: "HTML" });
    });
  },
};

async function showStandingReminders(ctx: BotContext): Promise<void> {
  const reminders = listActiveReminders().filter(
    (r) => r.cron_expression !== null
  );

  if (reminders.length === 0) {
    await ctx.reply("No active standing reminders.");
    return;
  }

  const lines = [`🔁 ${bold("Standing Reminders")}`, ""];

  for (const r of reminders) {
    lines.push(
      `#${r.id}: ${r.message}`,
      `  Schedule: ${r.cron_expression}`,
      `  Next: ${formatDate(r.next_fire_at, { includeTime: true })}`,
      ""
    );
  }

  lines.push("Cancel: /standing cancel [id]");

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

async function cancelStanding(
  ctx: BotContext,
  reminderId: number
): Promise<void> {
  deactivateReminder(reminderId);
  await ctx.reply(`🔕 Standing reminder #${reminderId} cancelled.`);
}
