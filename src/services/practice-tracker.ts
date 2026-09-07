import type { Bot } from "grammy";
import type { BotContext } from "../middleware/user-context.js";
import { config } from "../config.js";

export type PracticeStep =
  | "task"
  | "expense"
  | "shop"
  | "dm_research"
  | "group_message";

export const STEP_LABELS: Record<PracticeStep, string> = {
  task: "Add a task",
  expense: "Log an expense",
  shop: "Add to the shopping list",
  dm_research: "Ask a question in DM",
  group_message: "Send a message in the group",
};

const STEP_HINTS: Record<PracticeStep, string> = {
  task: 'Try: /task buy new mop for the office',
  expense: 'Try: /expense 300 uber to CBD',
  shop: 'Try: /shop add detergent, bin liners',
  dm_research: "DM the bot any question — like: What's the best place to buy office furniture in Nairobi?",
  group_message: 'Head to the group chat and send any message',
};

const STEP_ORDER: PracticeStep[] = [
  "task",
  "expense",
  "shop",
  "dm_research",
  "group_message",
];

const progress = new Map<number, Set<PracticeStep>>();

export function getPracticeProgress(userId: number): {
  completed: PracticeStep[];
  remaining: PracticeStep[];
  done: number;
  total: number;
} {
  const completed = progress.get(userId) ?? new Set<PracticeStep>();
  const completedArr = STEP_ORDER.filter((s) => completed.has(s));
  const remaining = STEP_ORDER.filter((s) => !completed.has(s));
  return { completed: completedArr, remaining, done: completedArr.length, total: STEP_ORDER.length };
}

export function resetPracticeProgress(): void {
  progress.clear();
}

export async function markPracticeStep(
  ctx: BotContext,
  step: PracticeStep,
  bot: Bot
): Promise<void> {
  // Only track in sandbox mode
  if (!ctx.isSandbox) return;

  const userId = ctx.from?.id;
  if (!userId) return;

  if (!progress.has(userId)) {
    progress.set(userId, new Set());
  }

  const userProgress = progress.get(userId)!;

  // Already completed this step — no duplicate message
  if (userProgress.has(step)) return;

  userProgress.add(step);

  const { done, remaining, total } = getPracticeProgress(userId);

  if (done < total) {
    // Still steps remaining
    const nextStep = remaining[0];
    await ctx.reply(
      `✅ ${STEP_LABELS[step]} — done! (${done}/${total} practice steps)\n👉 Next: ${STEP_HINTS[nextStep]}`
    );
  } else {
    // All done!
    await ctx.reply(
      `🎉 All ${total} practice steps complete! You've got the hang of it.\n\nNjenga has been notified — he'll switch to live mode when ready.`
    );

    // Notify Njenga via DM (only when the associate completes, not Njenga himself)
    if (userId !== config.telegram.jayUserId) {
      const name = ctx.dbUser?.name ?? ctx.from?.first_name ?? "Someone";
      try {
        await bot.api.sendMessage(
          config.telegram.jayUserId,
          `📣 ${name} has completed all ${total} practice steps and is ready to go live!\n\nUse /golive when you're ready.`
        );
      } catch (err) {
        console.error("Failed to notify Njenga about practice completion:", err);
      }
    }
  }
}
