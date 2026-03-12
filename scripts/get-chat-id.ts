/**
 * Fetches recent updates from the Telegram Bot API and prints any group chat IDs found.
 */
const token = process.argv[2];
if (!token) {
  console.log("Usage: npx tsx scripts/get-chat-id.ts <BOT_TOKEN>");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
const data = (await res.json()) as {
  result: Array<{
    message?: { chat: { id: number; title?: string; type: string } };
    my_chat_member?: { chat: { id: number; title?: string; type: string } };
  }>;
};

const chats = new Map<number, { id: number; title?: string; type: string }>();
for (const u of data.result || []) {
  const chat = u.message?.chat || u.my_chat_member?.chat;
  if (chat && chat.type !== "private") {
    chats.set(chat.id, chat);
  }
}

if (chats.size === 0) {
  console.log("No group chats found. Make sure you:");
  console.log("  1. Added the bot to a group");
  console.log("  2. Sent a message in the group AFTER adding the bot");
} else {
  for (const [, c] of chats) {
    console.log(`Found: ${c.title ?? "unnamed"} (ID: ${c.id})`);
  }
}
