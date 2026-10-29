import { LangCode, isLangCode } from "./i18n";

export interface ReminderSettings {
  /** Empty until first run, when it is taken from Obsidian's language. */
  language: LangCode | "";
  systemNotification: boolean;
  popup: boolean;
  /** "HH:mm" used for reminders written with a date only. */
  defaultTime: string;
  minuteStep: number;
  snoozeMinutes: number;
  openOnStart: boolean;
  /** Reminders already notified (keys from reminderKey), with the time they were due, to avoid repeats. */
  notified: Record<string, number>;
}

export const DEFAULT_SETTINGS: ReminderSettings = {
  language: "",
  systemNotification: true,
  popup: true,
  defaultTime: "09:00",
  minuteStep: 5,
  snoozeMinutes: 10,
  openOnStart: false,
  notified: {},
};

export const STEPS = [1, 5, 10, 15, 30];

export function parseTime(s: string): { hour: number; minute: number } | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export function sanitizeSettings(raw: unknown): ReminderSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
  const step = Number(r.minuteStep);
  const snooze = Math.floor(Number(r.snoozeMinutes));
  const notified: Record<string, number> = {};
  if (r.notified && typeof r.notified === "object") {
    for (const [k, v] of Object.entries(r.notified as Record<string, unknown>)) if (typeof v === "number") notified[k] = v;
  }
  return {
    language: isLangCode(r.language) ? r.language : "",
    systemNotification: bool(r.systemNotification, d.systemNotification),
    popup: bool(r.popup, d.popup),
    defaultTime: typeof r.defaultTime === "string" && parseTime(r.defaultTime) ? r.defaultTime.trim() : d.defaultTime,
    minuteStep: STEPS.includes(step) ? step : d.minuteStep,
    snoozeMinutes: Number.isFinite(snooze) && snooze >= 1 && snooze <= 1440 ? snooze : d.snoozeMinutes,
    openOnStart: bool(r.openOnStart, d.openOnStart),
    notified,
  };
}

/** Forget notified reminders that were due more than 30 days ago, so the list does not grow forever. */
export function pruneNotified(notified: Record<string, number>, now: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, due] of Object.entries(notified)) if (now - due < 30 * 86_400_000) out[k] = due;
  return out;
}
