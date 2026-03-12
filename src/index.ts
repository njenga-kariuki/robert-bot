import { config } from "./config.js";
import { initDb, migrate } from "./db/client.js";
import { createBot } from "./bot.js";
import { startScheduler, scheduleBiweeklySummary } from "./services/scheduler.js";
import { webhookCallback } from "grammy";
import { createServer } from "http";

async function main() {
  console.log("Robert Bot starting...");

  // Initialize and migrate DB
  await initDb();
  migrate();
  console.log("Database ready");

  // Create bot
  const bot = createBot();

  // Start scheduler for reminders
  startScheduler(bot);
  scheduleBiweeklySummary(bot);
  console.log("Scheduler started");

  // HTTP server for health checks (runs in both modes)
  let handleUpdate: ((req: any, res: any) => Promise<void>) | null = null;

  const server = createServer(async (req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
      return;
    }

    if (handleUpdate && req.url === "/webhook" && req.method === "POST") {
      await handleUpdate(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(config.webhook.port, () => {
    console.log(`HTTP server listening on port ${config.webhook.port}`);
  });

  if (config.webhook.url) {
    // ----- Production: Webhook mode -----
    handleUpdate = webhookCallback(bot, "http");
    await bot.api.setWebhook(`${config.webhook.url}/webhook`);
    console.log(`Webhook set: ${config.webhook.url}/webhook`);
  } else {
    // ----- Development: Long-polling mode -----
    await bot.api.deleteWebhook();
    console.log("Starting long-polling mode...");
    bot.start({
      onStart: () => console.log("Bot is running (long-polling)"),
    });
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down...");
    bot.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
