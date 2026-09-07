import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import type { BotContext } from "../middleware/user-context.js";
import { createNote, listNotes, deleteNote } from "../db/client.js";
import { bold } from "../utils/telegram.js";

export const note: Command = {
  name: "note",
  description:
    "Save a personal note. Works in your DM with the bot. e.g. /note follow up on water dispenser quotes",
  examples: [
    "/note follow up on water dispenser quotes",
    "/note list",
    "/note delete 3",
  ],
  register(bot: Bot<Context>) {
    bot.command("note", async (ctx_) => {
      const ctx = ctx_ as BotContext;

      if (!ctx.isDM) {
        await ctx.reply(
          "This is your personal workspace — message me directly to save notes and ask questions privately."
        );
        return;
      }

      const text = (ctx.match as string).trim();

      if (!text) {
        return await showNotes(ctx);
      }

      const lower = text.toLowerCase();

      if (lower === "list") {
        return await showNotes(ctx);
      }

      if (lower.startsWith("delete ") || lower.startsWith("del ")) {
        const id = parseInt(text.replace(/^(delete|del)\s+/i, "").trim());
        if (!isNaN(id) && ctx.dbUser) {
          deleteNote(id, ctx.dbUser.id);
          await ctx.reply(`🗑 Note #${id} deleted.`);
          return;
        }
      }

      if (!ctx.dbUser) {
        await ctx.reply("I don't recognize your account. Contact Njenga.");
        return;
      }

      const newNote = createNote(text, ctx.dbUser.id);
      await ctx.reply(`📝 Noted (#${newNote.id}): ${text}`);
    });
  },
};

async function showNotes(ctx: BotContext): Promise<void> {
  if (!ctx.dbUser) {
    await ctx.reply("I don't recognize your account.");
    return;
  }

  const notes = listNotes(ctx.dbUser.id);

  if (notes.length === 0) {
    await ctx.reply(
      "No notes yet. Save one with /note [text] or just ask me anything here."
    );
    return;
  }

  const lines = [`📝 ${bold("Your Notes")}`, ""];
  for (const n of notes) {
    const date = n.created_at.split("T")[0];
    lines.push(`#${n.id} (${date}): ${n.content}`);
  }
  lines.push("", "Delete: /note delete [id]");

  await ctx.reply(lines.join("\n"), { parse_mode: "HTML" });
}
