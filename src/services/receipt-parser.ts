import type { Bot, Context } from "grammy";
import { analyzeReceipt, type ReceiptData } from "./claude.js";
import { createExpense } from "../db/client.js";
import type { BotContext } from "../middleware/user-context.js";
import { InlineKeyboard } from "grammy";
import { formatKES, bold } from "../utils/telegram.js";

// Pending receipt confirmations (awaiting button tap)
const pendingReceipts = new Map<
  string,
  { data: ReceiptData; photoId: string; loggedBy: number | null }
>();

// Pending detail requests (awaiting follow-up text describing what the expense was for)
// Key: `${chatId}_${userId}` — maps to the receipt callback ID
const pendingDetails = new Map<string, string>();

/**
 * Handle a photo message — analyze as potential receipt.
 */
export async function handlePhoto(ctx: BotContext): Promise<void> {
  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) return;

  const photo = photos[photos.length - 1];
  const caption = ctx.message?.caption;

  try {
    await ctx.replyWithChatAction("typing");

    const file = await ctx.api.getFile(photo.file_id);
    const url = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");

    const ext = file.file_path?.split(".").pop()?.toLowerCase() ?? "jpg";
    const mediaType = ext === "png" ? "image/png" : "image/jpeg";

    const data = await analyzeReceipt(
      base64,
      mediaType as "image/jpeg" | "image/png",
      caption ?? undefined
    );

    if (!data.amount) {
      // Couldn't extract an amount — might not be a receipt, stay silent
      return;
    }

    const callbackId = `receipt_${Date.now()}`;
    pendingReceipts.set(callbackId, {
      data,
      photoId: photo.file_id,
      loggedBy: ctx.dbUser?.id ?? null,
    });

    // Build confirmation message
    const needsDetails = !data.description && !data.vendor;

    const keyboard = new InlineKeyboard()
      .text("Yes ✓", `${callbackId}_yes`)
      .text("Not an expense", `${callbackId}_no`)
      .row()
      .text("Add details", `${callbackId}_detail`)
      .text("Edit amount", `${callbackId}_edit`);

    const parts = [
      `📝 ${bold("Expense detected")}`,
      `Amount: ${bold(formatKES(data.amount))}`,
    ];
    if (data.vendor) parts.push(`Vendor: ${data.vendor}`);
    if (data.category && data.category !== "other")
      parts.push(`Category: ${data.category}`);
    if (data.description) parts.push(`Items: ${data.description}`);
    if (data.mpesa_code) parts.push(`M-Pesa: ${data.mpesa_code}`);

    if (needsDetails) {
      parts.push(
        "",
        "⚠️ I couldn't tell what this was for.",
        'Tap "Add details" to describe what was purchased.'
      );
    }

    parts.push("", "Is this correct?");

    await ctx.reply(parts.join("\n"), {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error("Receipt parsing error:", err);
    await ctx.reply(
      "Sorry, I couldn't process that image. Try sending it again or use /expense to log manually."
    );
  }
}

/**
 * Check if a text message is a follow-up providing details for a pending receipt.
 * Returns true if the message was consumed (caller should not process further).
 */
export function handlePendingDetail(ctx: BotContext): boolean {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return false;

  const key = `${chatId}_${userId}`;
  const callbackId = pendingDetails.get(key);
  if (!callbackId) return false;

  const pending = pendingReceipts.get(callbackId);
  if (!pending) {
    pendingDetails.delete(key);
    return false;
  }

  // Attach the user's description to the pending receipt
  const description = ctx.message?.text?.trim();
  if (!description) return false;

  pending.data.description = description;
  pendingDetails.delete(key);

  // Now save the expense
  const expense = createExpense({
    amount: pending.data.amount!,
    vendor: pending.data.vendor ?? undefined,
    category: pending.data.category,
    description: description,
    receipt_photo_id: pending.photoId,
    mpesa_code: pending.data.mpesa_code ?? undefined,
    expense_date: pending.data.expense_date ?? undefined,
    logged_by: pending.loggedBy ?? undefined,
  });
  pendingReceipts.delete(callbackId);

  ctx
    .reply(
      `✅ Logged: ${formatKES(expense.amount)}${expense.vendor ? " at " + expense.vendor : ""} — ${description} (#${expense.id})`,
      { parse_mode: "HTML" }
    )
    .catch(console.error);

  return true;
}

/**
 * Register callback query handlers for receipt confirmation buttons.
 */
export function registerReceiptCallbacks(bot: Bot<Context>): void {
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    const match = data.match(/^(receipt_\d+)_(yes|no|edit|detail)$/);
    if (!match) return;

    const [, callbackId, action] = match;
    const pending = pendingReceipts.get(callbackId);

    if (!pending) {
      await ctx.answerCallbackQuery({ text: "This receipt has expired." });
      return;
    }

    if (action === "yes") {
      const expense = createExpense({
        amount: pending.data.amount!,
        vendor: pending.data.vendor ?? undefined,
        category: pending.data.category,
        description: pending.data.description ?? undefined,
        receipt_photo_id: pending.photoId,
        mpesa_code: pending.data.mpesa_code ?? undefined,
        expense_date: pending.data.expense_date ?? undefined,
        logged_by: pending.loggedBy ?? undefined,
      });
      pendingReceipts.delete(callbackId);
      await ctx.answerCallbackQuery({ text: "Expense saved!" });
      await ctx.editMessageText(
        `✅ Logged: ${formatKES(expense.amount)}${expense.vendor ? " at " + expense.vendor : ""} (${expense.category})${expense.description ? " — " + expense.description : ""} #${expense.id}`,
        { parse_mode: "HTML" }
      );
    } else if (action === "no") {
      pendingReceipts.delete(callbackId);
      await ctx.answerCallbackQuery({ text: "Dismissed." });
      await ctx.editMessageText("Dismissed — not an expense.");
    } else if (action === "detail") {
      // Ask for item details — track this user so their next message attaches as description
      const chatId = ctx.callbackQuery.message?.chat.id;
      const userId = ctx.callbackQuery.from.id;
      if (chatId && userId) {
        pendingDetails.set(`${chatId}_${userId}`, callbackId);
      }
      await ctx.answerCallbackQuery({ text: "Send description" });
      await ctx.editMessageText(
        `📝 ${bold(formatKES(pending.data.amount!))}${pending.data.vendor ? " at " + pending.data.vendor : ""}\n\n` +
          "What was this for? Send a message describing the items/purpose.\n" +
          'Example: "Rice, cooking oil, and sugar from Naivas"'
      );
    } else if (action === "edit") {
      await ctx.answerCallbackQuery({ text: "Send corrections" });
      await ctx.editMessageText(
        "Send the corrected details, e.g.:\n/expense 500 rice at Naivas"
      );
      pendingReceipts.delete(callbackId);
    }
  });
}
