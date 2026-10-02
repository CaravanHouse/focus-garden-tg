interface TgWebApp {
  initData: string;
  ready(): void;
  expand(): void;
  HapticFeedback?: { notificationOccurred(t: "success" | "error" | "warning"): void; impactOccurred(s: "light" | "medium" | "heavy"): void };
}
declare global { interface Window { Telegram?: { WebApp: TgWebApp } } }

/** undefined, если открыто просто в браузере */
export const tg = window.Telegram?.WebApp;
export const initData = () => tg?.initData ?? "";
export const haptic = (t: "success" | "error") => tg?.HapticFeedback?.notificationOccurred(t);
