import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { extractParams } from "../services/claude.js";
import {
  createTask,
  listTasks,
  updateTaskStatus,
  getUserByName,
  type DbUser,
} from "../db/client.js";
import { bold, notifyGroup } from "../utils/telegram.js";
import { formatDate } from "../utils/dates.js";
import { nowInTimezone } from "../utils/dates.js";
import { getBotInstance } from "../bot.js";
import { markPracticeStep } from "../services/practice-tracker.js";

interface TaskParams {
  action: "add" | "list" | "done" | "cancel";
  assignee: string | null;
  title: string | null;
  description: string | null;
  due_date: string | null;
  priority: string | null;
  task_id: number | null;
}

export const task: Command = {
  name: "task",
  description:
    "Manage tasks — add, list, or complete. e.g. /task Robert get water dispenser quotes by Friday",
  examples: [
    "/task Robert get water dispenser quotes by Friday",
    "/task list",
    "/task list Robert",
    "/task done 3",
  ],
  register(bot: Bot<Context>) {
    bot.command("task", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const text = ctx.match as string;
      const senderName = ctx.dbUser?.name ?? "Unknown";
      const now = nowInTimezone();

      if (!text.trim()) {
        // No args = list all open tasks
        return await showTaskList(ctx);
      }

      // Quick shortcuts
      const lower = text.trim().toLowerCase();
      if (lower.startsWith("list")) {
        const filterName = text.replace(/^list\s*/i, "").trim();
        return await showTaskList(ctx, filterName || undefined);
      }

      if (lower.startsWith("done ") || lower.startsWith("complete ")) {
        const id = parseInt(text.replace(/^(done|complete)\s+/i, "").trim());
        if (!isNaN(id)) return await completeTask(ctx, id);
      }

      if (lower.startsWith("cancel ")) {
        const id = parseInt(text.replace(/^cancel\s+/i, "").trim());
        if (!isNaN(id)) return await cancelTask(ctx, id);
      }

      // Full NL parsing
      const params = await extractParams<TaskParams>(
        "task",
        text,
        `{
          "action": "add|list|done|cancel",
          "assignee": "Jay|Robert|both|null",
          "title": "short task title",
          "description": "optional longer description or null",
          "due_date": "YYYY-MM-DD or null",
          "priority": "low|normal|high|urgent or null",
          "task_id": "number or null (for done/cancel actions)"
        }`,
        senderName,
        now.toISOString()
      );

      if (params.action === "list") {
        return await showTaskList(ctx, params.assignee ?? undefined);
      }

      if (params.action === "done" && params.task_id) {
        return await completeTask(ctx, params.task_id);
      }

      if (params.action === "cancel" && params.task_id) {
        return await cancelTask(ctx, params.task_id);
      }

      // Default: add task
      if (!params.title) {
        return await ctx.reply("What's the task? e.g. /task Robert get water dispenser quotes by Friday");
      }

      let assignee: DbUser | undefined;
      if (params.assignee) {
        assignee = getUserByName(params.assignee);
      }

      const newTask = createTask({
        title: params.title,
        description: params.description ?? undefined,
        assignee_id: assignee?.id,
        priority: params.priority ?? undefined,
        due_date: params.due_date ?? undefined,
        created_by: ctx.dbUser?.id,
      });

      const parts = [`✅ Task #${newTask.id}: ${bold(newTask.title)}`];
      if (assignee) parts.push(`Assigned to: ${assignee.name}`);
      if (newTask.due_date) parts.push(`Due: ${formatDate(newTask.due_date)}`);
      if (newTask.priority !== "normal") parts.push(`Priority: ${newTask.priority}`);

      await ctx.reply(parts.join("\n"), { parse_mode: "HTML" });
      await markPracticeStep(ctx, "task", getBotInstance());

      if (ctx.isDM) {
        await notifyGroup(getBotInstance(), senderName, `📋 Task #${newTask.id}: ${newTask.title}${assignee ? ` (assigned to ${assignee.name})` : ""}`);
      }
    });

    // Handle NL-routed task intents
    bot.on("message:text", async (ctx_, next) => {
      const ctx = ctx_ as BotContext & {
        classifiedIntent?: { intent: string; params: Record<string, unknown> };
        fromNL?: boolean;
      };
      if (!ctx.fromNL || ctx.classifiedIntent?.intent !== "task") {
        return next();
      }

      const params = ctx.classifiedIntent.params as Partial<TaskParams>;
      if (params.action === "done" && params.task_id) {
        return await completeTask(ctx, params.task_id);
      }

      if (params.title) {
        let assignee: DbUser | undefined;
        if (params.assignee) {
          assignee = getUserByName(params.assignee as string);
        }

        const newTask = createTask({
          title: params.title,
          description: (params.description as string) ?? undefined,
          assignee_id: assignee?.id,
          priority: (params.priority as string) ?? undefined,
          due_date: params.due_date ?? undefined,
          created_by: ctx.dbUser?.id,
        });

        const parts = [`✅ Task #${newTask.id}: ${bold(newTask.title)}`];
        if (assignee) parts.push(`Assigned to: ${assignee.name}`);
        if (newTask.due_date) parts.push(`Due: ${formatDate(newTask.due_date)}`);

        await ctx.reply(parts.join("\n"), { parse_mode: "HTML" });
        await markPracticeStep(ctx, "task", getBotInstance());

        if (ctx.isDM) {
          const senderName = ctx.dbUser?.name ?? "Unknown";
          await notifyGroup(getBotInstance(), senderName, `📋 Task #${newTask.id}: ${newTask.title}${assignee ? ` (assigned to ${assignee.name})` : ""}`);
        }
      }
    });
  },
};

async function showTaskList(
  ctx: BotContext,
  filterName?: string
): Promise<void> {
  let assignee: DbUser | undefined;
  if (filterName) {
    assignee = getUserByName(filterName);
  }

  const tasks = listTasks({
    assignee_id: assignee?.id,
  });

  if (tasks.length === 0) {
    await ctx.reply(
      assignee
        ? `No open tasks for ${assignee.name}.`
        : "No open tasks. 🎉"
    );
    return;
  }

  const header = assignee
    ? `📋 ${bold("Open tasks for " + assignee.name)}`
    : `📋 ${bold("Open tasks")}`;

  const lines = tasks.map((t) => {
    const parts = [`#${t.id} ${t.title}`];
    if (t.due_date) parts.push(`(due ${formatDate(t.due_date)})`);
    if (t.priority !== "normal") parts.push(`[${t.priority}]`);
    return `  ${parts.join(" ")}`;
  });

  await ctx.reply(`${header}\n\n${lines.join("\n")}`, {
    parse_mode: "HTML",
  });
}

async function completeTask(ctx: BotContext, taskId: number): Promise<void> {
  const updated = updateTaskStatus(taskId, "done");
  if (!updated) {
    await ctx.reply(`Task #${taskId} not found.`);
    return;
  }
  await ctx.reply(`✅ Task #${taskId} done: ${updated.title}`);

  if (ctx.isDM) {
    const senderName = ctx.dbUser?.name ?? "Unknown";
    await notifyGroup(getBotInstance(), senderName, `✅ Task #${taskId} done: ${updated.title}`);
  }
}

async function cancelTask(ctx: BotContext, taskId: number): Promise<void> {
  const updated = updateTaskStatus(taskId, "cancelled");
  if (!updated) {
    await ctx.reply(`Task #${taskId} not found.`);
    return;
  }
  await ctx.reply(`❌ Task #${taskId} cancelled: ${updated.title}`);

  if (ctx.isDM) {
    const senderName = ctx.dbUser?.name ?? "Unknown";
    await notifyGroup(getBotInstance(), senderName, `❌ Task #${taskId} cancelled: ${updated.title}`);
  }
}
