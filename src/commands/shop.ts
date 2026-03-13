import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { extractParams } from "../services/claude.js";
import {
  addShoppingItem,
  listShoppingItems,
  markShoppingItemPurchased,
  deleteShoppingItem,
  clearPurchasedItems,
} from "../db/client.js";
import { bold } from "../utils/telegram.js";
import { formatDate } from "../utils/dates.js";
import { nowInTimezone } from "../utils/dates.js";

interface ShopParams {
  action: "add" | "list" | "done" | "remove" | "clear";
  items: { item: string; quantity: string | null }[];
  need_by: string | null;
  item_id: number | null;
}

export const shop: Command = {
  name: "shop",
  description:
    "Manage shopping list — add items, view list, mark purchased, remove items. e.g. /shop add 2kg rice, cooking oil",
  examples: [
    "/shop add 2kg rice, cooking oil need by Saturday",
    "/shop",
    "/shop done 3",
    "/shop remove 3",
    "/shop clear",
  ],
  register(bot: Bot<Context>) {
    bot.command("shop", async (ctx_) => {
      const ctx = ctx_ as BotContext;
      const text = (ctx.match as string).trim();
      const senderName = ctx.dbUser?.name ?? "Unknown";
      const now = nowInTimezone();

      // No args = show list
      if (!text) {
        return await showShoppingList(ctx);
      }

      // Quick shortcut: done
      const lower = text.toLowerCase();
      if (lower.startsWith("done ") || lower.startsWith("bought ")) {
        const id = parseInt(text.replace(/^(done|bought)\s+/i, "").trim());
        if (!isNaN(id)) return await markPurchased(ctx, id);
      }

      // Quick shortcut: remove/delete
      if (/^(remove|delete|del)\s+\d+/i.test(lower)) {
        const id = parseInt(text.replace(/^(remove|delete|del)\s+/i, "").trim());
        if (!isNaN(id)) return await removeItem(ctx, id);
      }

      // Quick shortcut: clear purchased
      if (lower === "clear") {
        return await clearPurchased(ctx);
      }

      // Quick shortcut: list
      if (lower === "list" || lower === "all") {
        return await showShoppingList(ctx, true);
      }

      // Parse with Claude
      const params = await extractParams<ShopParams>(
        "shop",
        text,
        `{
          "action": "add|list|done|remove|clear",
          "items": [{ "item": "item name", "quantity": "amount/quantity or null" }],
          "need_by": "YYYY-MM-DD or null",
          "item_id": "number or null (for done/remove action)"
        }`,
        senderName,
        now.toISOString()
      );

      if (params.action === "list") {
        return await showShoppingList(ctx);
      }

      if (params.action === "done" && params.item_id) {
        return await markPurchased(ctx, params.item_id);
      }

      if (params.action === "remove" && params.item_id) {
        return await removeItem(ctx, params.item_id);
      }

      if (params.action === "clear") {
        return await clearPurchased(ctx);
      }

      // Add items
      if (!params.items || params.items.length === 0) {
        await ctx.reply("What should I add? e.g. /shop add 2kg rice, cooking oil");
        return;
      }

      const added = [];
      for (const item of params.items) {
        const si = addShoppingItem({
          item: item.item,
          quantity: item.quantity ?? undefined,
          need_by: params.need_by ?? undefined,
          added_by: ctx.dbUser?.id,
        });
        added.push(si);
      }

      const itemList = added
        .map((a) => {
          const qty = a.quantity ? `${a.quantity} ` : "";
          return `  #${a.id} ${qty}${a.item}`;
        })
        .join("\n");

      let msg = `🛒 Added to shopping list:\n${itemList}`;
      if (params.need_by) msg += `\nNeed by: ${formatDate(params.need_by)}`;

      await ctx.reply(msg, { parse_mode: "HTML" });
    });

    // Handle NL-routed shopping intents
    bot.on("message:text", async (ctx_, next) => {
      const ctx = ctx_ as BotContext & {
        classifiedIntent?: { intent: string; params: Record<string, unknown> };
        fromNL?: boolean;
      };
      if (!ctx.fromNL || ctx.classifiedIntent?.intent !== "shop") {
        return next();
      }

      const p = ctx.classifiedIntent.params as Partial<ShopParams>;
      if (p.items && p.items.length > 0) {
        const added = [];
        for (const item of p.items) {
          const si = addShoppingItem({
            item: item.item,
            quantity: item.quantity ?? undefined,
            need_by: (p.need_by as string) ?? undefined,
            added_by: ctx.dbUser?.id,
          });
          added.push(si);
        }

        const itemList = added
          .map((a) => `  #${a.id} ${a.quantity ? a.quantity + " " : ""}${a.item}`)
          .join("\n");

        await ctx.reply(`🛒 Added to shopping list:\n${itemList}`, {
          parse_mode: "HTML",
        });
      }
    });
  },
};

async function showShoppingList(
  ctx: BotContext,
  showAll = false
): Promise<void> {
  const items = listShoppingItems(showAll);

  if (items.length === 0) {
    await ctx.reply("Shopping list is empty. 🎉");
    return;
  }

  const lines = [`🛒 ${bold("Shopping List")}`, ""];

  for (const item of items) {
    const qty = item.quantity ? `${item.quantity} ` : "";
    const check = item.purchased ? "☑️" : "☐";
    const needBy = item.need_by ? ` (by ${formatDate(item.need_by)})` : "";
    lines.push(`${check} #${item.id} ${qty}${item.item}${needBy}`);
  }

  lines.push("", "Mark purchased: /shop done [id] · Remove: /shop remove [id] · Clear purchased: /shop clear");

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}

async function removeItem(ctx: BotContext, itemId: number): Promise<void> {
  const item = deleteShoppingItem(itemId);
  if (!item) {
    await ctx.reply(`Item #${itemId} not found.`);
    return;
  }
  await ctx.reply(`🗑 Removed: ${item.item}`);
}

async function clearPurchased(ctx: BotContext): Promise<void> {
  const count = clearPurchasedItems();
  if (count === 0) {
    await ctx.reply("No purchased items to clear.");
    return;
  }
  await ctx.reply(`🗑 Cleared ${count} purchased item${count === 1 ? "" : "s"}.`);
}

async function markPurchased(ctx: BotContext, itemId: number): Promise<void> {
  const item = markShoppingItemPurchased(itemId);
  if (!item) {
    await ctx.reply(`Item #${itemId} not found.`);
    return;
  }
  await ctx.reply(`☑️ Purchased: ${item.item}`);
}
