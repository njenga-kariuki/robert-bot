import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import type { Command } from "../commands/types.js";

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// ----- Intent Classification -----

export interface ClassifiedIntent {
  intent: string;
  confidence: number;
  params: Record<string, unknown>;
}

/**
 * Classify a natural language message into a command intent.
 * Returns null if confidence < 0.7 (avoids interrupting casual chat).
 */
export async function classifyIntent(
  message: string,
  commands: Command[],
  senderName: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<ClassifiedIntent | null> {
  const commandList = commands
    .map((c) => `- ${c.name}: ${c.description}`)
    .join("\n");

  // Build messages array with history for context
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  // Ensure proper alternation — merge consecutive same-role messages
  const sanitized = sanitizeMessages(messages);
  sanitized.push({ role: "user" as const, content: message });

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 500,
    messages: sanitized,
    system: `You are a message classifier for a Telegram bot used to manage tasks, expenses, shopping, and reminders between Njenga (principal) and Robert (associate) in Nairobi, Kenya.

The sender of this message is: ${senderName}

Available commands:
${commandList}
- ignore: not a bot command, just casual conversation

Classify the user's LATEST message into one of these intents. Use the conversation history for context (e.g., "yes" after a clarification, or "add that to the list" after discussing an item).

The users may write in English, Sheng, Swahili, or a mix. Common patterns:
- "nilipay" / "nililipa" / "I paid" / "I spent" = expense
- "tunahitaji" / "we need" / "buy" = shopping
- "remind" / "nikumbushe" = remind
- Amounts in "bob" or "KES" or just numbers in context of spending = expense
- "yes" / "yeah" / "sawa" after a bot clarification = confirm the action the bot suggested

Respond ONLY with valid JSON (no markdown):
{
  "intent": "<command_name or ignore>",
  "confidence": <0.0-1.0>,
  "params": { <extracted parameters relevant to the command> }
}

For expense params: { amount, vendor, category, description }
For task params: { assignee, title, description, due_date, action }
For shopping params: { items: [{ item, quantity }], need_by }
For remind params: { target, message, datetime }

If the message is casual conversation, social, or unclear, use intent "ignore" with high confidence.`,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    return JSON.parse(text) as ClassifiedIntent;
  } catch {
    return null;
  }
}

// ----- Parameter Extraction -----

/**
 * Extract structured parameters from a command's free-form text argument.
 */
export async function extractParams<T>(
  commandName: string,
  text: string,
  schema: string,
  senderName: string,
  currentDate: string
): Promise<T> {
  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 500,
    messages: [{ role: "user", content: text }],
    system: `You extract structured parameters from a /${commandName} command.

Sender: ${senderName}
Current date/time (Africa/Nairobi): ${currentDate}
The two users are Njenga (principal, based in Seattle) and Robert (associate, based in Nairobi).

When parsing dates:
- "tomorrow" = the day after ${currentDate}
- "Friday" = the next upcoming Friday from ${currentDate}
- "next week" = the Monday of the next week
- Return dates as ISO format YYYY-MM-DD
- Return datetimes as ISO format YYYY-MM-DDTHH:mm:ss
- Default timezone is Africa/Nairobi (EAT, UTC+3)

When parsing people:
- "Robert" / "Rob" / "him" = Robert
- "Njenga" / "me" / "I" (if sender is Njenga) = Njenga
- "both" / "us" / "everyone" = both
- If no assignee mentioned and command is a task, default to Robert

Expected output schema:
${schema}

Respond ONLY with valid JSON (no markdown). Fill in what you can extract, use null for anything not mentioned.`,
  });

  const text2 =
    response.content[0].type === "text" ? response.content[0].text : "{}";
  return JSON.parse(text2) as T;
}

// ----- Receipt/Vision Processing -----

export interface ReceiptData {
  amount: number | null;
  vendor: string | null;
  category: "food" | "transport" | "supplies" | "utilities" | "other";
  description: string | null;
  mpesa_code: string | null;
  expense_date: string | null;
}

/**
 * Analyze a receipt or M-Pesa screenshot using Claude Vision.
 */
export async function analyzeReceipt(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif",
  caption?: string
): Promise<ReceiptData> {
  const userContent: Anthropic.MessageCreateParams["messages"][0]["content"] = [
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: imageBase64 },
    },
  ];

  if (caption) {
    userContent.push({
      type: "text",
      text: `Additional context from sender: "${caption}"`,
    });
  }

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 500,
    messages: [{ role: "user", content: userContent }],
    system: `You analyze receipt photos and M-Pesa transaction screenshots to extract expense information.

This is for expense tracking in Nairobi, Kenya. Common patterns:
- M-Pesa confirmation messages show: transaction code, amount, recipient, date
- Receipts show: vendor, items, totals
- Amounts are in KES (Kenyan Shillings)

Categories: food, transport, supplies, utilities, other

Respond ONLY with valid JSON (no markdown):
{
  "amount": <number in KES or null>,
  "vendor": "<vendor/recipient name or null>",
  "category": "<food|transport|supplies|utilities|other>",
  "description": "<brief description of what was purchased or null>",
  "mpesa_code": "<M-Pesa transaction code like ABC123XYZ or null>",
  "expense_date": "<YYYY-MM-DD or null>"
}`,
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "{}";
  return JSON.parse(text) as ReceiptData;
}

// ----- Lookup / Search -----

/**
 * Answer a Nairobi-context question using Claude's knowledge.
 * Used by /lookup in group chat.
 */
export async function lookupQuery(query: string): Promise<string> {
  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 1000,
    messages: [{ role: "user", content: query }],
    system: `You are a helpful assistant for someone managing logistics in Nairobi, Kenya.
Answer the question concisely and practically. Focus on:
- Business hours, locations, contact info
- Prices and availability
- Practical tips for getting things done in Nairobi

If you're not sure about specific current details (hours, prices), say so clearly.

FORMATTING: This response will be rendered in Telegram using HTML parse mode. Use Telegram-compatible HTML:
- <b>Section Name</b> for section headers (no <h1>/<h2> — Telegram ignores them)
- <i>emphasis</i> for emphasis
- • (bullet character) for lists — do NOT use markdown dashes
- Short paragraphs separated by blank lines for readability
- For tabular/comparison data, use <pre> monospace blocks with aligned columns (keep under 35 chars wide):
  <pre>Item        Amt     Status
  ─────────────────────────
  Tea         KES 50  paid</pre>
- Do NOT use markdown syntax: no #, **, __, \`\`\`, or | table pipes
- Keep answers short and conversational.`,
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : "Sorry, I couldn't process that query.";
}

// ----- DM Research Assistant -----

/**
 * General-purpose research assistant for DM conversations.
 * Handles any question — logistics, comparisons, how-to, pricing, planning.
 * Used when a DM message doesn't match any tracked command intent.
 */
export async function dmResearchQuery(
  query: string,
  senderName: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  opsContext = ""
): Promise<string> {
  // Build messages array with history
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const h of history) {
    messages.push({ role: h.role, content: h.content });
  }
  const sanitized = sanitizeMessages(messages);
  sanitized.push({ role: "user" as const, content: query });

  const opsSection = opsContext
    ? `\n\nCurrent operational data (answer from this when asked about tasks, expenses, shopping, reminders):\n${opsContext}`
    : "";

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 2000,
    messages: sanitized,
    system: `You are a helpful research assistant in a Telegram DM with ${senderName}.

${senderName} works with Njenga on business operations and logistics, primarily in Nairobi, Kenya. They may ask about:
- Prices, vendors, and where to find things in Nairobi
- How to do something (practical tasks, logistics, errands)
- Comparisons (which option is better, pros/cons)
- General knowledge questions
- Help with communication (drafting messages, translating)
- Planning and problem-solving
- Current tasks, expenses, shopping list, or reminders (use the operational data below)

Be practical, direct, and helpful. Give actionable answers.
If a question is about Nairobi/Kenya, draw on local context (M-Pesa, matatus, common stores, etc.).
If you're unsure about current specifics (prices, hours), say so and give your best estimate.

FORMATTING: This response will be rendered in Telegram using HTML parse mode. Use Telegram-compatible HTML:
- <b>Section Name</b> for section headers (no <h1>/<h2> — Telegram ignores them)
- <i>emphasis</i> for emphasis
- • (bullet character) for lists — do NOT use markdown dashes
- Short paragraphs separated by blank lines for readability
- For tabular/comparison data, use <pre> monospace blocks with aligned columns (keep under 35 chars wide):
  <pre>Item        Amt     Status
  ─────────────────────────
  Tea         KES 50  paid</pre>
- Do NOT use markdown syntax: no #, **, __, \`\`\`, or | table pipes
- Keep responses concise — this is chat, not a report${opsSection}`,
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : "Sorry, I couldn't help with that. Try rephrasing?";
}

/**
 * Generate a short clarification question when confidence is in the 0.4-0.7 band.
 * Returns a concise, actionable question like "Add rice to the shopping list?"
 */
export async function groupClarifyQuery(
  originalMessage: string,
  intent: ClassifiedIntent,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<string> {
  const historyContext =
    history.length > 0
      ? `\nRecent conversation:\n${history.slice(-6).map((h) => `${h.role}: ${h.content}`).join("\n")}`
      : "";

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Original message: "${originalMessage}"
Classified as: ${intent.intent} (confidence: ${intent.confidence})
Extracted params: ${JSON.stringify(intent.params)}${historyContext}

Generate a short, friendly clarification question to confirm if the user meant this action. Keep it under 15 words. Examples:
- "Add rice and cooking oil to the shopping list?"
- "Create a task to call the supplier?"
- "Log KES 500 expense at Naivas?"`,
      },
    ],
    system:
      "You generate short clarification questions for a Telegram bot. Reply with ONLY the question text, no quotes, no markdown.",
  });

  return response.content[0].type === "text"
    ? response.content[0].text
    : `Did you mean to ${intent.intent}?`;
}

/**
 * Sanitize message array for Anthropic API compliance.
 * Merges consecutive same-role messages and ensures alternation.
 */
function sanitizeMessages(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Array<{ role: "user" | "assistant"; content: string }> {
  if (messages.length === 0) return [];

  const result: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const msg of messages) {
    if (result.length > 0 && result[result.length - 1].role === msg.role) {
      // Merge with previous message of same role
      result[result.length - 1] = {
        role: msg.role,
        content: result[result.length - 1].content + "\n" + msg.content,
      };
    } else {
      result.push({ ...msg });
    }
  }
  return result;
}
