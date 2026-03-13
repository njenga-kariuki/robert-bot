import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import { bold } from "../utils/telegram.js";

const GUIDE_PAGE_1 = `${bold("Hey! Welcome to our shared assistant 👋")}

This bot makes our work together easier and faster. Think of it as a shared notebook that both of us can update from anywhere — plus it's smart enough to read receipts and remind us about things.

${bold("Two places to use it:")}

${bold("Group chat")} = the shared record
Anything that affects both of you shows up here — tasks, expenses, reminders. This is where you talk to each other.

${bold("DM the bot")} = your personal workspace
Tap the bot's name → "Send Message" to open your DM.
You can do ${bold("everything")} from DM — log expenses, add tasks, check lists, ask questions. The bot automatically posts important updates (expenses, tasks) to the group so nobody misses anything. Shopping, notes, and research stay private.

${bold("One rule:")} Use DM when you're doing your work. Use group when you want to talk to each other.

${bold("4 ways to use it:")}
1️⃣ Commands — start with / (like /task, /shop)
2️⃣ Photos — snap a receipt or M-Pesa, it reads it automatically
3️⃣ Just type normally — "I spent 500 on rice at Naivas"
4️⃣ The bot may ask — if it thinks you meant to do something but isn't sure, it'll ask: "Did you mean to add rice to the shopping list?" Just confirm or ignore it.

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

Don't need it anymore? Cancel it:
  /task cancel 3

${bold("💰 Expenses — the easy part")}

${bold("Fastest way:")} just snap a photo of the receipt or M-Pesa confirmation and send it here. The bot reads it and asks you to confirm. If it can't read the details, tap "Add details" and type what it was for.

You can also type it:
  /expense 500 rice at Naivas
  /expense 1200 uber to Westlands

Or just say it naturally:
  "I spent 500 on rice at Naivas"

Logged by mistake? Delete it:
  /expense delete 3

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

Added by mistake? Remove it:
  /shop remove 3

Done shopping? Clear purchased items:
  /shop clear

${bold("🔔 Reminders")}

Set a one-time reminder:
  /remind pick up laundry tomorrow 10am

See pending reminders:
  /remind list

Cancel a reminder:
  /remind cancel 3

Set a recurring one:
  /standing every Friday 3pm expense review

See recurring reminders:
  /standing list

Cancel a recurring one:
  /standing cancel 3

${bold("🔍 Your personal AI assistant (in your DM)")}

This is the big one. Open your DM with the bot and just type anything — no commands needed. It's like having your own researcher on call, 24/7.

${bold("What stays private:")} research questions, notes, shopping list changes
${bold("What the bot echoes to group:")} expenses and tasks you log from DM — so both of you stay in sync without extra effort. The echo is silent (no notification buzz).

Try things like:
• "Where's the cheapest place to get a gas cylinder in Westlands?"
• "What time does Naivas close on Sundays?"
• "Help me draft a message to the landlord about the water issue"
• "How do I calculate import duty on electronics from China?"

It remembers context within the conversation, so you can follow up naturally.

You can also ask about your actual data:
• "What tasks are open right now?"
• "How much did we spend this week?"
• "What's on the shopping list?"
It knows what's in the system and can answer from real data.

Personal reminders (like "remind Robert to pick up laundry") will fire in your DM — not the group. Shared reminders go to the group as before.

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

${bold("Try typing naturally in the group (no / needed):")}
• "we need more sugar and cooking oil"
• The bot might ask: "Add sugar and cooking oil to the shopping list?" — just say "yes"

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
