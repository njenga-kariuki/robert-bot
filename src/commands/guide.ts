import { InlineKeyboard } from "grammy";
import type { Bot, Context } from "grammy";
import type { Command } from "./types.js";
import { bold } from "../utils/telegram.js";

const GUIDE_PAGE_1 = `${bold("1/4 · Hey! Welcome to our shared assistant 👋")}

This bot makes our work together easier and faster. Think of it as a shared notebook that both of us can update from anywhere — plus it's smart enough to read receipts and remind us about things.

${bold("Two places to use it:")}

${bold("Group chat")} = the shared record
Tasks, expenses, and reminders show up in the group — visible to both of you. That's where you talk to each other.

${bold("DM the bot")} = your personal workspace
You can do ${bold("everything")} from DM — log expenses, add tasks, check lists, ask questions. The bot automatically posts important updates (expenses, tasks) to the group so nobody misses anything. Shopping, notes, and research stay private in your DM.

${bold("One rule:")} Use DM when you're doing your work. Use group when you want to talk to each other.

${bold("4 ways to use it:")}
1️⃣ Commands — start with / (like /task, /shop)
2️⃣ Photos — snap a receipt or M-Pesa, it reads it automatically
3️⃣ Just type normally — "I spent 500 on rice at Naivas"
4️⃣ The bot may ask — "Did you mean to add rice to the shopping list?" Just say yes or ignore it.

That's the big picture. When you're ready, tap a button below 👇`;

const GUIDE_PAGE_2 = `${bold("2/4 · 📋 Tasks — keeping track of what needs doing")}

Add something to the list:
  /task get water dispenser quotes by Friday
  /task pick up laundry tomorrow

See what's open:
  /task list

Done with something? Mark it:
  /task done 3  (use the number next to each task)

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

Got it? Next up 👇`;

const GUIDE_PAGE_3 = `${bold("3/4 · 🛒 Shopping List")}

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

${bold("🔍 Your personal AI assistant")}

This is the big one. In your DM with the bot, just type anything — no commands needed. It's like having your own researcher on call, 24/7.

${bold("What stays private:")} research questions, notes, shopping list changes
${bold("What the bot copies to group:")} expenses and tasks you log from DM — so both of you stay in sync without extra effort. It posts quietly (no notification buzz).

Try things like:
• "Where's the cheapest place to get a gas cylinder in Westlands?"
• "What time does Naivas close on Sundays?"
• "Help me draft a message to the landlord about the water issue"
• "How do I calculate import duty on electronics from China?"

It remembers what you talked about, so you can follow up naturally.

You can also ask about your actual data:
• "What tasks are open right now?"
• "How much did we spend this week?"
• "What's on the shopping list?"
It knows your tasks, expenses, and shopping list — and can answer from real data.

Personal reminders (like "remind Robert to pick up laundry") will come to your DM — not the group. Shared reminders go to the group as usual.

In the ${bold("group chat")}, use /lookup for quick shared questions:
  /lookup Java House Westlands hours

That's everything the bot can do! Now let's try it for real 👇`;

const GUIDE_PAGE_4 = `${bold("4/4 · 🏖 Practice mode")}

The bot is in practice mode right now — nothing you do here is real, so don't worry about messing anything up.

Let's try a few things. Do them one at a time — wait for the bot to reply before moving on.

${bold("Step 1 — Add a task")}
Tap to copy, then send 👇
<code>/task buy new mop for the office</code>
The bot will reply with your new task. ✅

${bold("Step 2 — Log an expense")}
Tap to copy, then send 👇
<code>/expense 300 uber to CBD</code>
The bot will confirm the amount and what it was for.

${bold("Step 3 — Add to the shopping list")}
Tap to copy, then send 👇
<code>/shop add detergent, bin liners</code>
The bot will show you what was added.

${bold("Step 4 — Ask a question")}
This one you type yourself — just copy or type something like:
What's the best place to buy office furniture in Nairobi?
The bot will answer like a real assistant. Try any question you like!

${bold("Step 5 — Try the group chat")}
Now open your group chat with Jay and type something like:
"we need more sugar and cooking oil"
The bot might ask: "Add sugar and cooking oil to the shopping list?" — just say yes.
While you're there, scroll up — you should see the task and expense from Steps 1–2 posted there automatically.

${bold("The bot tracks your progress")}
As you complete each step, I'll confirm and tell you what's next. When all 5 are done, Jay gets notified automatically — no extra steps needed.

Want to check progress anytime? Type /ready`;

const PAGE_1_NAV = new InlineKeyboard()
  .text("Tasks & Expenses →", "guide_2")
  .row()
  .text("Shopping, Reminders & Research →", "guide_3")
  .row()
  .text("🏖 Practice mode →", "guide_4");

const PAGE_2_NAV = new InlineKeyboard()
  .text("← Overview", "guide_1")
  .text("Shopping, Reminders & Research →", "guide_3");

const PAGE_3_NAV = new InlineKeyboard()
  .text("← Tasks & Expenses", "guide_2")
  .text("🏖 Practice mode →", "guide_4");

const PAGE_4_NAV = new InlineKeyboard()
  .text("← Back to guide", "guide_1");

export const guide: Command = {
  name: "guide",
  description: "Step-by-step walkthrough of how to use the bot",
  register(bot: Bot<Context>) {
    bot.command("guide", async (ctx) => {
      const page = (ctx.match as string).trim();

      if (page === "2") {
        await ctx.reply(GUIDE_PAGE_2, { parse_mode: "HTML", reply_markup: PAGE_2_NAV });
      } else if (page === "3") {
        await ctx.reply(GUIDE_PAGE_3, { parse_mode: "HTML", reply_markup: PAGE_3_NAV });
      } else if (page === "4") {
        await ctx.reply(GUIDE_PAGE_4, { parse_mode: "HTML", reply_markup: PAGE_4_NAV });
      } else {
        await ctx.reply(GUIDE_PAGE_1, { parse_mode: "HTML", reply_markup: PAGE_1_NAV });
      }
    });

    bot.callbackQuery(/^guide_(\d+)$/, async (ctx) => {
      const page = ctx.match[1];
      if (page === "1") {
        await ctx.editMessageText(GUIDE_PAGE_1, { parse_mode: "HTML", reply_markup: PAGE_1_NAV });
      } else if (page === "2") {
        await ctx.editMessageText(GUIDE_PAGE_2, { parse_mode: "HTML", reply_markup: PAGE_2_NAV });
      } else if (page === "3") {
        await ctx.editMessageText(GUIDE_PAGE_3, { parse_mode: "HTML", reply_markup: PAGE_3_NAV });
      } else if (page === "4") {
        await ctx.editMessageText(GUIDE_PAGE_4, { parse_mode: "HTML", reply_markup: PAGE_4_NAV });
      }
      await ctx.answerCallbackQuery();
    });
  },
};
