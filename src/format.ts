// How a reminder is written in a task line, and how lines are changed. Pure functions only.
//
//   - [ ] Buy milk ⏰ 2026-10-26 09:00
//
// The marker is kept as plain text, so the note stays readable without the plugin.

export const MARK = "⏰";

/** A task line: indentation, list marker, the character in the box, and the rest. */
const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[)(.)(\]\s?)(.*)$/;
const REMINDER = /\s*⏰\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2}))?/u;
/** A block id at the end of a line stays at the end. */
const BLOCK_ID = /(\s\^[A-Za-z0-9-]+)\s*$/;

export interface TaskLine {
  done: boolean;
  /** The task text without the reminder. */
  text: string;
  /** Local date and time of the reminder, or null. */
  due: { date: string; hour: number; minute: number; allDay: boolean } | null;
}

export function isTaskLine(line: string): boolean {
  return TASK.test(line);
}

export function parseTaskLine(line: string, defaultHour = 9, defaultMinute = 0): TaskLine | null {
  const m = TASK.exec(line);
  if (!m) return null;
  const done = m[2] !== " ";
  const rest = m[4];
  const r = REMINDER.exec(rest);
  let due: TaskLine["due"] = null;
  if (r && isValidDate(r[1])) {
    const hour = r[2] === undefined ? defaultHour : Number(r[2]);
    const minute = r[3] === undefined ? defaultMinute : Number(r[3]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) due = { date: r[1], hour, minute, allDay: r[2] === undefined };
  }
  const text = (r ? rest.slice(0, r.index) + rest.slice(r.index + r[0].length) : rest).replace(BLOCK_ID, "").trim();
  return { done, text, due };
}

export function isValidDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** With no hour, only the date is written; the reminder then comes at the default time. */
export function formatDue(date: string, hour: number | null, minute: number | null): string {
  return hour === null ? `${MARK} ${date}` : `${MARK} ${date} ${pad(hour)}:${pad(minute ?? 0)}`;
}

/** The due time as a local Date. */
export function dueTime(due: NonNullable<TaskLine["due"]>): Date {
  const [y, mo, d] = due.date.split("-").map(Number);
  return new Date(y, mo - 1, d, due.hour, due.minute, 0, 0);
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Put a reminder on a task line, replacing any that is there. Lines that are not tasks are returned as they are. */
export function setReminder(line: string, date: string, hour: number | null, minute: number | null): string {
  const m = TASK.exec(line);
  if (!m) return line;
  let rest = m[4].replace(REMINDER, "");
  const id = BLOCK_ID.exec(rest);
  if (id) rest = rest.slice(0, id.index);
  rest = rest.replace(/\s+$/, "");
  const mark = formatDue(date, hour, minute);
  return m[1] + m[2] + m[3] + (rest === "" ? mark : `${rest} ${mark}`) + (id ? id[1] : "");
}

export function clearReminder(line: string): string {
  const m = TASK.exec(line);
  if (!m) return line;
  return m[1] + m[2] + m[3] + m[4].replace(REMINDER, "");
}

export function completeTask(line: string): string {
  const m = TASK.exec(line);
  if (!m) return line;
  return m[1] + "x" + m[3] + m[4];
}

/** Move a reminder later by `minutes` from `now` (used by "snooze"). */
export function snooze(line: string, now: Date, minutes: number): string {
  const t = new Date(now.getTime() + minutes * 60_000);
  return setReminder(line, toDateString(t), t.getHours(), t.getMinutes());
}

/** Text that identifies one reminder, so it is notified only once. */
export function reminderKey(path: string, task: TaskLine): string {
  const d = task.due;
  return d ? `${path}\u0000${task.text}\u0000${d.date}${d.allDay ? "" : ` ${pad(d.hour)}:${pad(d.minute)}`}` : "";
}
