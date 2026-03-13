import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { extractParams } from "../services/claude.js";
import { createReminder, getUserByName, listActiveReminders, deactivateReminder } from "../db/client.js";
import { createCalendarEvent } from "../services/gcal.js";
import { bold } from "../utils/telegram.js";
import { formatDate } from "../utils/dates.js";
import { nowInTimezone } from "../utils/dates.js";

interface RemindParams {
  target: "Jay" | "Robert" | "both" | null;
  message: string | null;
  datetime: string | null; // ISO datetime
}

export const remind: Command = {
  name: "remind",
  description:
    "Set, list, or cancel a one-time reminder. e.g. /remind Robert pick up laundry tomorrow 10am",
  examples: [
    "/remind Robert pick up laundry tomorrow 10am",
    "/remind both expense review Friday 3pm",
    "/remind list",
    "/remind cancel 3",
  ],
  register(bot: Bot<Context>) {
    bot.command("remind", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const text = (ctx.match as string).trim();
      const senderName = ctx.dbUser?.name ?? "Unknown";
      const now = nowInTimezone();

      if (!text) {
        await ctx.reply(
          "Set a reminder:\n/remind [who] [message] [when]\n\nExample: /remind Robert pick up laundry tomorrow 10am\n\n/remind list — see pending reminders\n/remind cancel [id] — cancel a reminder"
        );
        return;
      }

      // Quick shortcut: list
      const lower = text.toLowerCase();
      if (lower === "list") {
        return await listReminders(ctx);
      }

      // Quick shortcut: cancel
      if (/^cancel\s+\d+/i.test(lower)) {
        const id = parseInt(text.replace(/^cancel\s+/i, "").trim());
        if (!isNaN(id)) return await cancelReminder(ctx, id);
      }

      const params = await extractParams<RemindParams>(
        "remind",
        text,
        `{
          "target": "Jay|Robert|both|null (who to remind, null=both)",
          "message": "the reminder message",
          "datetime": "ISO datetime YYYY-MM-DDTHH:mm:ss (in Africa/Nairobi timezone)"
        }`,
        senderName,
        now.toISOString()
      );

      if (!params.message) {
        await ctx.reply("What should I remind about?");
        return;
      }

      if (!params.datetime) {
        await ctx.reply("When should I send the reminder? e.g. tomorrow 10am, Friday 3pm");
        return;
      }

      // Resolve target user
      let targetUserId: number | undefined;
      let targetLabel = "everyone";
      if (params.target && params.target !== "both") {
        const user = getUserByName(params.target);
        if (user) {
          targetUserId = user.id;
          targetLabel = user.name;
        }
      }

      // Create calendar event
      const gcalEventId = await createCalendarEvent({
        summary: params.message,
        description: `Reminder for ${targetLabel}`,
        startTime: params.datetime,
      });

      // Create reminder in DB
      const reminder = createReminder({
        message: params.message,
        target_user_id: targetUserId,
        next_fire_at: params.datetime,
        created_by: ctx.dbUser?.id,
        gcal_event_id: gcalEventId ?? undefined,
      });

      const parts = [
        `🔔 Reminder #${reminder.id} set`,
        `For: ${bold(targetLabel)}`,
        `Message: ${params.message}`,
        `When: ${formatDate(params.datetime, { includeTime: true })}`,
      ];
      if (gcalEventId) parts.push("📅 Added to Google Calendar");

      await ctx.reply(parts.join("\n"), { parse_mode: "HTML" });
    });

    // Handle NL-routed remind intents
    bot.on("message:text", async (ctx_, next) => {
      const ctx = ctx_ as BotContext & {
        classifiedIntent?: { intent: string; params: Record<string, unknown> };
        fromNL?: boolean;
      };
      if (!ctx.fromNL || ctx.classifiedIntent?.intent !== "remind") {
        return next();
      }

      const p = ctx.classifiedIntent.params as Partial<RemindParams>;
      if (!p.message || !p.datetime) return;

      let targetUserId: number | undefined;
      let targetLabel = "everyone";
      if (p.target && p.target !== "both") {
        const user = getUserByName(p.target);
        if (user) {
          targetUserId = user.id;
          targetLabel = user.name;
        }
      }

      const gcalEventId = await createCalendarEvent({
        summary: p.message,
        startTime: p.datetime,
      });

      const reminder = createReminder({
        message: p.message,
        target_user_id: targetUserId,
        next_fire_at: p.datetime,
        created_by: ctx.dbUser?.id,
        gcal_event_id: gcalEventId ?? undefined,
      });

      await ctx.reply(
        `🔔 Reminder #${reminder.id} set for ${bold(targetLabel)}: ${p.message}\n${formatDate(p.datetime, { includeTime: true })}`,
        { parse_mode: "HTML" }
      );
    });
  },
};

async function listReminders(ctx: BotContext): Promise<void> {
  const reminders = listActiveReminders().filter((r) => !r.cron_expression);
  if (reminders.length === 0) {
    await ctx.reply("No pending one-time reminders.");
    return;
  }

  const lines = [`🔔 ${bold("Pending Reminders")}`, ""];
  for (const r of reminders) {
    lines.push(`#${r.id} "${r.message}" — ${formatDate(r.next_fire_at, { includeTime: true })}`);
  }
  lines.push("", "Cancel: /remind cancel [id]");

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

async function cancelReminder(ctx: BotContext, reminderId: number): Promise<void> {
  const reminders = listActiveReminders();
  const reminder = reminders.find((r) => r.id === reminderId);
  if (!reminder) {
    await ctx.reply(`Reminder #${reminderId} not found or already inactive.`);
    return;
  }
  deactivateReminder(reminderId);
  await ctx.reply(`🔕 Cancelled reminder #${reminderId}: "${reminder.message}"`);
}
