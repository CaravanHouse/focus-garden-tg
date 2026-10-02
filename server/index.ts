import "dotenv/config";
import { Bot } from "grammy";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { registerHandlers, setupMenu, telegramNotifier } from "./bot";
import { Garden, type Notifier } from "./garden";

const token = process.env.BOT_TOKEN;
const devNoAuth = process.env.DEV_NO_AUTH === "1";
const webappUrl = process.env.WEBAPP_URL;
const port = Number(process.env.PORT ?? 3000);
// На Railway укажите путь к подключённому Volume (например /data), иначе данные сотрутся при деплое
const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");

if (!token && !devNoAuth) { console.error("Укажите BOT_TOKEN в .env (или DEV_NO_AUTH=1 для запуска без бота)"); process.exit(1); }

const bot = token ? new Bot(token) : null;
const noop: Notifier = { async treeGrown() {}, async reminder() {} };
const garden = new Garden(join(dataDir, "garden.json"), bot ? telegramNotifier(bot.api, webappUrl) : noop);
garden.restoreTimers();

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
createApp(garden, token ?? "dev", devNoAuth, dist).listen(port, () => console.log(`API и мини-апп: http://localhost:${port}`));

if (bot) {
  registerHandlers(bot, garden, webappUrl);
  bot.catch((e) => console.error("Ошибка бота:", e.message));
  void setupMenu(bot, webappUrl);
  void bot.start({ onStart: (me) => console.log(`Бот @${me.username} запущен`) });
}

process.on("SIGTERM", () => { garden.db.flush(); process.exit(0); });
