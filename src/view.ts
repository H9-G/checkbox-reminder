import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type CheckboxReminderPlugin from "./main";
import type { MessageKey } from "./i18n";
import { Group, groupOf } from "./store";

export const VIEW_TYPE_REMINDERS = "checkbox-reminder-list";

const GROUPS: [Group, MessageKey][] = [
  ["overdue", "groupOverdue"],
  ["today", "groupToday"],
  ["tomorrow", "groupTomorrow"],
  ["week", "groupWeek"],
  ["later", "groupLater"],
];

const pad = (n: number) => String(n).padStart(2, "0");

/** All open reminders of the vault, earliest first, in the side bar. */
export class ReminderListView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: CheckboxReminderPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_REMINDERS;
  }

  getDisplayText(): string {
    return this.plugin.t("viewTitle");
  }

  getIcon(): string {
    return "alarm-clock";
  }

  async onOpen(): Promise<void> {
    this.render();
    // Headings such as "today" change as time passes.
    this.registerInterval(window.setInterval(() => this.render(), 60_000));
  }

  render(): void {
    const t = (k: MessageKey, v?: Record<string, string | number>) => this.plugin.t(k, v);
    const el = this.contentEl;
    el.empty();
    el.addClass("checkbox-reminder-view");
    const all = this.plugin.store.all();
    if (all.length === 0) {
      el.createDiv({ cls: "checkbox-reminder-empty", text: t("viewEmpty") });
      return;
    }
    const now = new Date();
    for (const [group, label] of GROUPS) {
      const items = all.filter((r) => groupOf(r.due, now, r.task.due?.allDay === true) === group);
      if (items.length === 0) continue;
      el.createDiv({ cls: `checkbox-reminder-group checkbox-reminder-group-${group}`, text: `${t(label)} (${items.length})` });
      for (const r of items) {
        const item = el.createDiv({ cls: "checkbox-reminder-item" + (group === "overdue" ? " is-overdue" : "") });
        const box = item.createEl("input", { type: "checkbox", cls: "task-list-item-checkbox" });
        box.setAttr("aria-label", t("done"));
        box.addEventListener("click", (e) => {
          e.stopPropagation();
          void this.plugin.complete(r);
        });
        const body = item.createDiv({ cls: "checkbox-reminder-item-body" });
        body.createDiv({ cls: "checkbox-reminder-item-text", text: r.task.text || "—" });
        const d = r.due;
        const allDay = r.task.due?.allDay === true;
        const sameDay = d.toDateString() === now.toDateString();
        const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const date = `${d.getFullYear() === now.getFullYear() ? "" : d.getFullYear() + "/"}${d.getMonth() + 1}/${d.getDate()}`;
        const when = allDay ? (sameDay ? t("groupToday") : date) : sameDay ? time : `${date} ${time}`;
        const meta = body.createDiv({ cls: "checkbox-reminder-item-meta" });
        meta.createSpan({ text: when });
        meta.createSpan({ cls: "checkbox-reminder-item-file", text: r.path.replace(/\.md$/, "").split("/").pop() ?? r.path });
        const edit = item.createSpan({ cls: "checkbox-reminder-item-edit clickable-icon" });
        setIcon(edit, "alarm-clock");
        edit.setAttr("aria-label", t("clockEdit", { when }));
        edit.addEventListener("click", (e) => {
          e.stopPropagation();
          this.plugin.editFromList(r);
        });
        item.addEventListener("click", () => void this.plugin.openAt(r.path, r.line));
      }
    }
  }
}
