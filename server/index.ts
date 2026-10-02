import "dotenv/config";
import { Bot } from "grammy";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { httpsUrl, onRailway } from "./env";
import { registerHandlers, setupMenu, telegramNotifier } from "./bot";
import { Garden, type Notifier } from "./garden";

const token = process.env.BOT_TOKEN;
const devNoAuth = process.env.DEV_NO_AUTH === "1";
const webappUrl = httpsUrl("WEBAPP_URL", process.env.WEBAPP_URL);
const port = Number(process.env.PORT ?? 3000);
// На Railway укажите путь к подключённому Volume (например /data), иначе данные сотрутся при деплое
const dataDir = process.env.DATA_DIR || join(process.cwd(), "data");

if (devNoAuth && onRailway) {
  console.error("DEV_NO_AUTH=1 на сервере пускает в API любого без проверки Telegram. Поставьте DEV_NO_AUTH=0.");
  process.exit(1);
}
if (!token && !devNoAuth) { console.error("Укажите BOT_TOKEN в .env (или DEV_NO_AUTH=1 для запуска без бота)"); process.exit(1); }
if (token && !webappUrl) console.warn("WEBAPP_URL не задан: кнопка «Открыть сад» не появится. Укажите https-адрес проекта");

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

// Railway останавливает сервис через SIGTERM: успеваем записать данные на диск
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { garden.db.flush(); process.exit(0); });
