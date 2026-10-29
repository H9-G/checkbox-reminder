// All open reminders of the vault, kept up to date from the notes.
import { TaskLine, dueTime, parseTaskLine } from "./format";

export interface Reminder {
  path: string;
  /** 0-based line number in the note. */
  line: number;
  /** The whole line as it was read, used to check nothing changed before editing it. */
  raw: string;
  task: TaskLine;
  due: Date;
}

/** Reminders of one note's text (open tasks only). */
export function remindersIn(path: string, content: string, defaultHour: number, defaultMinute: number): Reminder[] {
  const out: Reminder[] = [];
  const lines = content.split("\n");
  let fence: string | null = null;
  lines.forEach((raw, line) => {
    const fm = /^\s*(`{3,}|~{3,})/.exec(raw);
    if (fm) {
      if (fence === null) fence = fm[1][0];
      else if (fm[1][0] === fence) fence = null;
      return;
    }
    if (fence !== null || !raw.includes("⏰")) return;
    const task = parseTaskLine(raw.replace(/\r$/, ""), defaultHour, defaultMinute);
    if (!task || task.done || !task.due) return;
    out.push({ path, line, raw: raw.replace(/\r$/, ""), task, due: dueTime(task.due) });
  });
  return out;
}

export class ReminderStore {
  private byPath = new Map<string, Reminder[]>();

  set(path: string, reminders: Reminder[]): void {
    if (reminders.length === 0) this.byPath.delete(path);
    else this.byPath.set(path, reminders);
  }

  delete(path: string): void {
    this.byPath.delete(path);
  }

  rename(oldPath: string, newPath: string): void {
    const list = this.byPath.get(oldPath);
    if (!list) return;
    this.byPath.delete(oldPath);
    this.byPath.set(newPath, list.map((r) => ({ ...r, path: newPath })));
  }

  /** Every reminder, earliest first. */
  all(): Reminder[] {
    return [...this.byPath.values()].flat().sort((a, b) => a.due.getTime() - b.due.getTime() || a.path.localeCompare(b.path) || a.line - b.line);
  }
}

export type Group = "overdue" | "today" | "tomorrow" | "week" | "later";

/** Which heading a reminder goes under in the list. */
export function groupOf(due: Date, now: Date, allDay = false): Group {
  // A date-only reminder belongs to its whole day; it is overdue only once that day is over.
  if (allDay ? due.toDateString() !== now.toDateString() && due.getTime() < now.getTime() : due.getTime() < now.getTime()) return "overdue";
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - start.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return "week";
  return "later";
}
