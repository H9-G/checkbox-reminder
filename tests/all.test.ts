import assert from "node:assert/strict";
import { clearReminder, completeTask, dueTime, isValidDate, parseTaskLine, reminderKey, setReminder, snooze } from "../src/format";
import { ReminderStore, groupOf, remindersIn } from "../src/store";
import { parseTime, pruneNotified, sanitizeSettings } from "../src/settings";
import { suggestedTime } from "../src/picker";
import { allDicts, detectLanguage, tr } from "../src/i18n";

let passed = 0;
let failed = 0;
const queue: [string, () => unknown][] = [];
const test = (name: string, fn: () => unknown) => queue.push([name, fn]);

test("reads a task line with a reminder", () => {
  assert.deepEqual(parseTaskLine("- [ ] 牛乳を買う ⏰ 2026-10-26 09:30"), {
    done: false,
    text: "牛乳を買う",
    due: { date: "2026-10-26", hour: 9, minute: 30, allDay: false },
  });
  assert.equal(parseTaskLine("  * [x] done ⏰ 2026-10-26 09:30")?.done, true);
  assert.equal(parseTaskLine("1. [ ] numbered")?.text, "numbered");
  assert.equal(parseTaskLine("plain text"), null);
  assert.equal(parseTaskLine("- [ ] no reminder")?.due, null);
});
test("a date without a time uses the default time; invalid dates are ignored", () => {
  assert.deepEqual(parseTaskLine("- [ ] a ⏰ 2026-10-26", 8, 15)?.due, { date: "2026-10-26", hour: 8, minute: 15, allDay: true });
  assert.equal(parseTaskLine("- [ ] a ⏰ 2026-02-30 10:00")?.due, null);
  assert.equal(parseTaskLine("- [ ] a ⏰ 2026-10-26 25:00")?.due, null);
  assert.equal(isValidDate("2028-02-29"), true);
  assert.equal(isValidDate("2027-02-29"), false);
});
test("setting a reminder adds or replaces it and keeps block ids at the end", () => {
  assert.equal(setReminder("- [ ] 牛乳", "2026-10-26", 9, 0), "- [ ] 牛乳 ⏰ 2026-10-26 09:00");
  assert.equal(setReminder("- [ ] 牛乳 ⏰ 2026-10-26 09:00", "2026-11-01", 18, 5), "- [ ] 牛乳 ⏰ 2026-11-01 18:05");
  assert.equal(setReminder("- [ ] 牛乳 ^abc123", "2026-10-26", 9, 0), "- [ ] 牛乳 ⏰ 2026-10-26 09:00 ^abc123");
  assert.equal(setReminder("- [ ] ", "2026-10-26", 9, 0), "- [ ] ⏰ 2026-10-26 09:00");
  assert.equal(setReminder("not a task", "2026-10-26", 9, 0), "not a task");
  assert.equal(setReminder("- [ ] 牛乳 ⏰ 2026-10-26 09:00", "2026-10-27", null, null), "- [ ] 牛乳 ⏰ 2026-10-27");
  assert.equal(setReminder("- [ ] 牛乳 ⏰ 2026-10-27", "2026-10-27", 18, 0), "- [ ] 牛乳 ⏰ 2026-10-27 18:00");
  assert.equal(setReminder("\t- [ ] 字下げ", "2026-10-26", 9, 0), "\t- [ ] 字下げ ⏰ 2026-10-26 09:00");
});
test("clearing, completing and snoozing", () => {
  assert.equal(clearReminder("- [ ] 牛乳 ⏰ 2026-10-26 09:00 ^id"), "- [ ] 牛乳 ^id");
  assert.equal(completeTask("- [ ] 牛乳 ⏰ 2026-10-26 09:00"), "- [x] 牛乳 ⏰ 2026-10-26 09:00");
  assert.equal(snooze("- [ ] 牛乳 ⏰ 2026-10-26 09:00", new Date(2026, 9, 26, 23, 55), 10), "- [ ] 牛乳 ⏰ 2026-10-27 00:05");
});
test("due time is local time", () => {
  const d = dueTime({ date: "2026-10-26", hour: 9, minute: 30, allDay: false });
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()], [2026, 9, 26, 9, 30]);
});
test("reminders of a note: open tasks only, not inside code blocks", () => {
  const note = [
    "- [ ] A ⏰ 2026-10-26 09:00",
    "- [x] B ⏰ 2026-10-26 09:00",
    "```",
    "- [ ] C ⏰ 2026-10-26 09:00",
    "```",
    "- [ ] D",
    "  - [ ] E ⏰ 2026-10-25 08:00\r",
  ].join("\n");
  const list = remindersIn("n.md", note, 9, 0);
  assert.deepEqual(list.map((r) => [r.task.text, r.line]), [["A", 0], ["E", 6]]);
  assert.equal(list[1].raw.endsWith("\r"), false);
});
test("the store sorts by due time and follows renames and deletes", () => {
  const s = new ReminderStore();
  s.set("a.md", remindersIn("a.md", "- [ ] late ⏰ 2026-12-01 09:00", 9, 0));
  s.set("b.md", remindersIn("b.md", "- [ ] soon ⏰ 2026-10-26 09:00", 9, 0));
  assert.deepEqual(s.all().map((r) => r.task.text), ["soon", "late"]);
  s.rename("b.md", "c.md");
  assert.equal(s.all()[0].path, "c.md");
  s.delete("a.md");
  assert.equal(s.all().length, 1);
  s.set("c.md", []);
  assert.equal(s.all().length, 0);
});
test("groups for the list", () => {
  const now = new Date(2026, 9, 25, 12, 0);
  assert.equal(groupOf(new Date(2026, 9, 25, 11, 0), now), "overdue");
  assert.equal(groupOf(new Date(2026, 9, 25, 23, 0), now), "today");
  assert.equal(groupOf(new Date(2026, 9, 26, 0, 0), now), "tomorrow");
  assert.equal(groupOf(new Date(2026, 9, 31, 9, 0), now), "week");
  assert.equal(groupOf(new Date(2026, 10, 15, 9, 0), now), "later");
  assert.equal(groupOf(new Date(2026, 9, 25, 9, 0), now, true), "today", "date-only today stays under today");
  assert.equal(groupOf(new Date(2026, 9, 24, 9, 0), now, true), "overdue");
});
test("a reminder is identified by note, text and time, so changing the time notifies again", () => {
  const a = parseTaskLine("- [ ] x ⏰ 2026-10-26 09:00")!;
  const b = parseTaskLine("- [ ] x ⏰ 2026-10-26 09:10")!;
  assert.notEqual(reminderKey("n.md", a), reminderKey("n.md", b));
  assert.equal(reminderKey("n.md", a), reminderKey("n.md", parseTaskLine("- [ ] x ⏰ 2026-10-26 9:00")!));
});
test("suggested time is at least an hour ahead, on the minute grid", () => {
  assert.deepEqual(suggestedTime(new Date(2026, 9, 25, 12, 7), 5), { date: "2026-10-25", hour: 13, minute: 10 });
  assert.deepEqual(suggestedTime(new Date(2026, 9, 25, 23, 58), 15), { date: "2026-10-26", hour: 1, minute: 0 });
});
test("settings", () => {
  const s = sanitizeSettings({ minuteStep: 7, defaultTime: "25:00", snoozeMinutes: 30, notified: { a: 1, b: "x" } });
  assert.equal(s.minuteStep, 5);
  assert.equal(s.defaultTime, "09:00");
  assert.equal(s.snoozeMinutes, 30);
  assert.deepEqual(s.notified, { a: 1 });
  assert.deepEqual(parseTime("7:05"), { hour: 7, minute: 5 });
  const now = Date.now();
  assert.deepEqual(Object.keys(pruneNotified({ old: now - 40 * 86_400_000, recent: now - 86_400_000 }, now)), ["recent"]);
  assert.equal(tr("ja", "snooze", { n: 10 }), "10分後に再通知");
});

test("every language has every message with the same placeholders", () => {
  const dicts = allDicts();
  const keys = Object.keys(dicts.en).sort();
  assert.equal(Object.keys(dicts).length, 8);
  for (const [lang, d] of Object.entries(dicts)) {
    assert.deepEqual(Object.keys(d).sort(), keys, lang);
    for (const k of keys) {
      const v = (d as Record<string, string>)[k];
      assert.ok(v.trim() !== "", `${lang}.${k}`);
      const ph = (x: string) => (x.match(/\{\w+\}/g) ?? []).sort().join();
      assert.equal(ph(v), ph((dicts.en as Record<string, string>)[k]), `${lang}.${k} placeholders`);
    }
  }
  assert.equal(detectLanguage("zh-Hant-TW"), "zh-TW");
  assert.equal(detectLanguage("ko-KR"), "ko");
  assert.equal(detectLanguage("it"), "en");
  assert.equal(tr("de", "snooze", { n: 5 }), "5 Min. später erinnern");
  assert.equal(sanitizeSettings({ language: "fr" }).language, "fr");
  assert.equal(sanitizeSettings({ language: "xx" }).language, "");
});

(async () => {
  for (const [name, fn] of queue) {
    try {
      await fn();
      passed++;
      console.log("ok   " + name);
    } catch (e) {
      failed++;
      console.error("FAIL " + name + "\n     " + String((e as Error).message).split("\n").join("\n     "));
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
