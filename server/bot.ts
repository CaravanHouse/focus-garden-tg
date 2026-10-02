import { Api, Bot, InlineKeyboard } from "grammy";
import { esc } from "./auth";
import type { Garden, Notifier } from "./garden";
import { DEMO_SECONDS, KIND_NAME } from "../shared/constants";

const openKb = (url?: string) => (url ? new InlineKeyboard().webApp("🌱 Открыть сад", url) : undefined);

export function telegramNotifier(api: Api, webappUrl?: string): Notifier {
  return {
    async treeGrown(userId, kind, seconds, stat) {
      const demo = seconds === DEMO_SECONDS;
      const text = demo
        ? `🌳 Выросла ${KIND_NAME[kind]} (демо-сессия, в рейтинг не идёт).`
        : `🌳 Выросла ${KIND_NAME[kind]}! ${Math.round(seconds / 60)} мин в фокусе.\nВсего деревьев: <b>${stat.trees}</b>, минут: <b>${stat.minutes}</b>.`;
      await api.sendMessage(userId, text, { parse_mode: "HTML", reply_markup: openKb(webappUrl) });
    },
    async reminder(userId) {
      await api.sendMessage(userId, "⏰ Время вышло! Откройте сад и посадите своё дерево.", { reply_markup: openKb(webappUrl) });
    },
  };
}

export function registerHandlers(bot: Bot, garden: Garden, webappUrl?: string) {
  bot.command("start", (ctx) =>
    ctx.reply(
      "🌱 <b>Сад фокуса</b>\n\nВыберите задачу, запустите таймер и работайте без отвлечений: пока идёт время, растёт дерево. Бросите раньше — оно засохнет.\n\n/me — моя статистика\n/top — лучшие лесники",
      { parse_mode: "HTML", reply_markup: openKb(webappUrl) }
    )
  );

  bot.command("me", (ctx) => {
    const s = ctx.from && garden.db.data.users[String(ctx.from.id)];
    if (!s) return ctx.reply("У вас пока нет деревьев. Откройте сад и посадите первое 🌱", { reply_markup: openKb(webappUrl) });
    return ctx.reply(`🌳 Деревьев: <b>${s.trees}</b>\n⏱ Минут в фокусе: <b>${s.minutes}</b>\n🥀 Засохло: <b>${s.withered}</b>`, { parse_mode: "HTML" });
  });

  bot.command("top", (ctx) => {
    const top = garden.top(10);
    if (top.length === 0) return ctx.reply("Лес пока пуст. Станьте первым!", { reply_markup: openKb(webappUrl) });
    const medals = ["🥇", "🥈", "🥉"];
    const lines = top.map((s, i) => `${medals[i] ?? `${i + 1}.`} ${esc(s.name)} — ${s.trees} 🌳 · ${s.minutes} мин`);
    return ctx.reply(`<b>Лучшие лесники</b>\n\n${lines.join("\n")}`, { parse_mode: "HTML" });
  });
}

/** Кнопка меню рядом с полем ввода открывает мини-апп */
export async function setupMenu(bot: Bot, webappUrl?: string) {
  if (!webappUrl) return;
  try {
    await bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: "Сад", web_app: { url: webappUrl } } });
    await bot.api.setMyCommands([
      { command: "start", description: "Открыть сад" },
      { command: "me", description: "Моя статистика" },
      { command: "top", description: "Лучшие лесники" },
    ]);
  } catch (e) { console.warn("Не удалось настроить меню:", (e as Error).message); }
}
