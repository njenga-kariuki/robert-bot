import type { Bot, Context } from "grammy";
import {
  getDueReminders,
  updateReminderNextFire,
  deactivateReminder,
  getUserByTelegramId,
  getAllUsers,
  getExpenseSummary,
  type DbUser,
} from "../db/client.js";
import { config } from "../config.js";
import { formatKES, bold } from "../utils/telegram.js";
import { nowInTimezone, toISODate, parsePeriod } from "../utils/dates.js";
import CronExpressionParser from "cron-parser";

const POLL_INTERVAL_MS = 60_000; // 60 seconds
let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the reminder scheduler loop.
 */
export function startScheduler(bot: Bot<Context>): void {
  if (intervalId) return;

  console.log("Scheduler started (60s interval)");

  intervalId = setInterval(async () => {
    try {
      await processReminders(bot);
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  }, POLL_INTERVAL_MS);

  // Also run immediately on start
  processReminders(bot).catch(console.error);
}

/**
 * Stop the scheduler loop.
 */
export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("Scheduler stopped");
  }
}

/**
 * Process all due reminders.
 */
async function processReminders(bot: Bot<Context>): Promise<void> {
  const dueReminders = getDueReminders();

  for (const reminder of dueReminders) {
    try {
      // Determine who to send to
      const users = getAllUsers();
      const targets: DbUser[] = reminder.target_user_id
        ? users.filter((u) => u.id === reminder.target_user_id)
        : users; // null = send to both

      // Send to group chat
      const targetNames = targets.map((t) => t.name).join(" & ");
      const message = `🔔 ${bold("Reminder")} for ${targetNames}:\n${reminder.message}`;

      await bot.api.sendMessage(config.telegram.groupChatId, message, {
        parse_mode: "HTML",
      });

      // Handle recurring vs one-time
      if (reminder.cron_expression) {
        // Recurring: compute next fire time
        const interval = CronExpressionParser.parse(reminder.cron_expression, {
          tz: config.timezone.default,
        });
        const next = interval.next().toISOString() as string;
        updateReminderNextFire(reminder.id, next);
      } else {
        // One-time: deactivate
        deactivateReminder(reminder.id);
      }
    } catch (err) {
      console.error(`Failed to fire reminder ${reminder.id}:`, err);
    }
  }
}

/**
 * Schedule the bi-weekly expense auto-summary.
 * Fires every other Monday at 9am EAT.
 */
export function scheduleBiweeklySummary(bot: Bot<Context>): void {
  // Check every poll cycle if it's time for bi-weekly summary
  // We use a simple date check rather than a separate cron
  let lastSummaryDate = "";

  const originalInterval = intervalId;
  // Piggyback on the existing scheduler loop
  const checkBiweekly = async () => {
    const now = nowInTimezone(config.timezone.nairobi);
    const today = toISODate(now);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday
    const hours = now.getHours();
    const weekNumber = Math.ceil(
      (now.getDate() + new Date(now.getFullYear(), now.getMonth(), 1).getDay()) / 7
    );

    // Fire on even-numbered Mondays at 9am
    if (
      dayOfWeek === 1 &&
      hours === 9 &&
      weekNumber % 2 === 0 &&
      lastSummaryDate !== today
    ) {
      lastSummaryDate = today;
      await sendExpenseSummary(bot);
    }
  };

  // Add to the main poll loop
  const origId = intervalId;
  if (origId) {
    clearInterval(origId);
  }
  intervalId = setInterval(async () => {
    try {
      await processReminders(bot);
      await checkBiweekly();
    } catch (err) {
      console.error("Scheduler error:", err);
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Send a formatted expense summary to the group.
 */
async function sendExpenseSummary(bot: Bot<Context>): Promise<void> {
  const { start, end, label } = parsePeriod("last 2 weeks");
  // Use last 14 days
  const now = nowInTimezone(config.timezone.nairobi);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);

  const startDate = toISODate(twoWeeksAgo);
  const endDate = toISODate(now);

  const summary = getExpenseSummary(startDate, endDate);
  if (summary.length === 0) return;

  const total = summary.reduce((sum, s) => sum + s.total, 0);
  const lines = [
    `📊 ${bold("Bi-weekly Expense Summary")}`,
    `${startDate} — ${endDate}`,
    "",
  ];

  for (const s of summary) {
    lines.push(`  ${s.category}: ${formatKES(s.total)} (${s.count} items)`);
  }

  lines.push("", `${bold("Total")}: ${formatKES(total)}`);

  await bot.api.sendMessage(config.telegram.groupChatId, lines.join("\n"), {
    parse_mode: "HTML",
  });
}
