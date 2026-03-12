import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import { bold } from "../utils/telegram.js";

const GUIDE_PAGE_1 = `${bold("Hey! Welcome to our shared assistant 👋")}

This bot makes our work together easier and faster. Think of it as a shared notebook that both of us can update from anywhere — plus it's smart enough to read receipts and remind us about things.

${bold("How it's set up:")}

${bold("Group chat")} = our shared workspace
Everything here, both of us can see:
• Tasks we're working on
• Expenses and receipts
• Shopping lists
• Reminders

${bold("DM the bot directly")} = your personal space
Tap the bot's name above → "Send Message" to open it.
• Ask it literally anything — it's a personal AI assistant, just for you
• Research prices, locations, questions — privately, without cluttering the group
• Save notes with /note
• Everything in the DM is between you and the bot only

${bold("3 ways to use it:")}
1️⃣ Commands — start with / (like /task, /shop)
2️⃣ Photos — snap a receipt or M-Pesa, it reads it automatically
3️⃣ Just type normally — "I spent 500 on rice at Naivas"

/guide 2 → Tasks & Expenses
/guide 3 → Shopping, Reminders & Research`;

const GUIDE_PAGE_2 = `${bold("📋 Tasks — keeping track of what needs doing")}

Add something to the list:
  /task get water dispenser quotes by Friday
  /task pick up laundry tomorrow

See what's open:
  /task list

Done with something? Mark it:
  /task done 3  (the # is next to each task)

${bold("💰 Expenses — the easy part")}

${bold("Fastest way:")} just snap a photo of the receipt or M-Pesa confirmation and send it here. The bot reads it and asks you to confirm. If it can't read the details, tap "Add details" and type what it was for.

You can also type it:
  /expense 500 rice at Naivas
  /expense 1200 uber to Westlands

Or just say it naturally:
  "I spent 500 on rice at Naivas"

See a summary:
  /spending this week
  /spending March

/guide 3 → Shopping, Reminders & Research`;

const GUIDE_PAGE_3 = `${bold("🛒 Shopping List")}

Add items:
  /shop add 2kg rice, cooking oil, sugar

See the list:
  /shop

Bought something? Check it off:
  /shop done 3

${bold("🔔 Reminders")}

Set a one-time reminder:
  /remind pick up laundry tomorrow 10am

Set a recurring one:
  /standing every Friday 3pm expense review

${bold("🔍 Your personal AI assistant (in your DM)")}

This is the big one. Open your DM with the bot and just type anything — no commands needed. It's like having your own researcher on call, 24/7. Nothing you ask shows up in the group.

Try things like:
• "Where's the cheapest place to get a gas cylinder in Westlands?"
• "What time does Naivas close on Sundays?"
• "Help me draft a message to the landlord about the water issue"
• "How do I calculate import duty on electronics from China?"

It remembers context within the conversation, so you can follow up naturally.

In the ${bold("group chat")}, use /lookup for quick shared questions:
  /lookup Java House Westlands hours

${bold("🏖 Practice mode — try everything now")}

Right now the bot is in practice mode — nothing is real yet. Try stuff out:

${bold("Here in the group:")}
• /task buy new mop for the office
• /expense 300 uber to CBD
• /shop add detergent, bin liners

${bold("Then open your DM with the bot:")}
Tap the bot's name above → "Send Message"
• Type: "What's the best place to buy office furniture in Nairobi?"
• It'll answer like a personal assistant — only you see it

Take your time, play around. When you're comfortable, come back here and type:

/ready

That tells Jay you're good, and he'll switch everything to live.`;

export const guide: Command = {
  name: "guide",
  description: "Step-by-step walkthrough of how to use the bot",
  register(bot: Bot<Context>) {
    bot.command("guide", async (ctx) => {
      const page = (ctx.match as string).trim();

      if (page === "2") {
        await ctx.reply(GUIDE_PAGE_2, { parse_mode: "HTML" });
      } else if (page === "3") {
        await ctx.reply(GUIDE_PAGE_3, { parse_mode: "HTML" });
      } else {
        await ctx.reply(GUIDE_PAGE_1, { parse_mode: "HTML" });
      }
    });
  },
};
