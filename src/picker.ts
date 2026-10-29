import { App, Modal } from "obsidian";
import { isValidDate, toDateString } from "./format";

export interface PickedTime {
  date: string;
  hour: number;
  minute: number;
  /** Date only: no time is written, and the default time is used. */
  allDay?: boolean;
}

export interface PickerLabels {
  title: string;
  date: string;
  time: string;
  noTime: string;
  quickIn1h: string;
  quickTonight: string;
  quickTomorrow: string;
  save: string;
  remove: string;
  cancel: string;
  invalidDate: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Next time on the minute grid, at least one hour from now. */
export function suggestedTime(now: Date, step: number): PickedTime {
  const t = new Date(now.getTime() + 60 * 60_000);
  const minute = Math.ceil(t.getMinutes() / step) * step;
  t.setMinutes(minute, 0, 0);
  return { date: toDateString(t), hour: t.getHours(), minute: t.getMinutes() };
}

/** Choose a date with the calendar of the date field and a time with two menus. */
export class ReminderPicker extends Modal {
  constructor(
    app: App,
    private labels: PickerLabels,
    private initial: PickedTime | null,
    private step: number,
    private onSave: (t: PickedTime) => void,
    private onRemove: (() => void) | null
  ) {
    super(app);
  }

  onOpen(): void {
    const l = this.labels;
    const start = this.initial ?? suggestedTime(new Date(), this.step);
    this.setTitle(l.title);
    const { contentEl } = this;
    contentEl.addClass("checkbox-reminder-picker");

    const dateRow = contentEl.createDiv({ cls: "checkbox-reminder-row" });
    dateRow.createEl("label", { text: l.date });
    const dateInput = dateRow.createEl("input", { type: "date", cls: "checkbox-reminder-date" });
    dateInput.value = start.date;

    const timeRow = contentEl.createDiv({ cls: "checkbox-reminder-row" });
    timeRow.createEl("label", { text: l.time });
    const hourSelect = timeRow.createEl("select", { cls: "dropdown" });
    for (let h = 0; h < 24; h++) hourSelect.createEl("option", { text: pad(h), value: String(h) });
    timeRow.createSpan({ text: ":" });
    const minuteSelect = timeRow.createEl("select", { cls: "dropdown" });
    const minutes = new Set<number>();
    for (let m = 0; m < 60; m += this.step) minutes.add(m);
    minutes.add(start.minute); // keep a time that is off the grid
    for (const m of [...minutes].sort((a, b) => a - b)) minuteSelect.createEl("option", { text: pad(m), value: String(m) });
    const setTime = (t: PickedTime) => {
      dateInput.value = t.date;
      hourSelect.value = String(t.hour);
      if (!Array.from(minuteSelect.options).some((o) => o.value === String(t.minute))) {
        minuteSelect.createEl("option", { text: pad(t.minute), value: String(t.minute) });
      }
      minuteSelect.value = String(t.minute);
    };
    setTime(start);

    const allDayRow = contentEl.createDiv({ cls: "checkbox-reminder-row checkbox-reminder-allday" });
    const allDay = allDayRow.createEl("input", { type: "checkbox" });
    allDay.id = "checkbox-reminder-allday";
    allDayRow.createEl("label", { text: l.noTime, attr: { for: allDay.id } });
    const syncAllDay = () => {
      hourSelect.disabled = allDay.checked;
      minuteSelect.disabled = allDay.checked;
      timeRow.toggleClass("is-disabled", allDay.checked);
    };
    allDay.checked = start.allDay === true;
    syncAllDay();
    allDay.addEventListener("change", syncAllDay);

    const quick = contentEl.createDiv({ cls: "checkbox-reminder-quick" });
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const plus1h = new Date(now.getTime() + 60 * 60_000);
    for (const [label, t] of [
      [l.quickIn1h, { date: toDateString(plus1h), hour: plus1h.getHours(), minute: plus1h.getMinutes() }],
      [l.quickTonight, { date: toDateString(now), hour: 20, minute: 0 }],
      [l.quickTomorrow, { date: toDateString(tomorrow), hour: 9, minute: 0 }],
    ] as [string, PickedTime][]) {
      quick.createEl("button", { text: label }).addEventListener("click", () => {
        setTime(t);
        allDay.checked = false;
        syncAllDay();
      });
    }

    const buttons = contentEl.createDiv({ cls: "modal-button-container" });
    if (this.onRemove) {
      const remove = buttons.createEl("button", { text: l.remove, cls: "mod-warning" });
      remove.addEventListener("click", () => {
        this.onRemove?.();
        this.close();
      });
    }
    buttons.createEl("button", { text: l.cancel }).addEventListener("click", () => this.close());
    const save = buttons.createEl("button", { text: l.save, cls: "mod-cta" });
    const error = contentEl.createDiv({ cls: "checkbox-reminder-error" });
    save.addEventListener("click", () => {
      if (!isValidDate(dateInput.value)) {
        error.setText(l.invalidDate);
        return;
      }
      this.onSave({ date: dateInput.value, hour: Number(hourSelect.value), minute: Number(minuteSelect.value), allDay: allDay.checked });
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
