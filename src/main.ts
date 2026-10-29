import { MarkdownView, Modal, Notice, Platform, Plugin, TFile, editorInfoField, getLanguage, setIcon } from "obsidian";
import { EditorView } from "@codemirror/view";
import { clockButtons } from "./editor";
import { clearReminder, completeTask, dueTime, parseTaskLine, reminderKey, setReminder, snooze, toDateString } from "./format";
import { MessageKey, detectLanguage, tr } from "./i18n";
import { PickedTime, PickerLabels, ReminderPicker } from "./picker";
import { DEFAULT_SETTINGS, ReminderSettings, parseTime, pruneNotified, sanitizeSettings } from "./settings";
import { ReminderSettingTab } from "./settingsTab";
import { Reminder, ReminderStore, remindersIn } from "./store";
import { ReminderListView, VIEW_TYPE_REMINDERS } from "./view";

const CHECK_EVERY_MS = 15_000;
const pad = (n: number) => String(n).padStart(2, "0");

export default class CheckboxReminderPlugin extends Plugin {
  settings: ReminderSettings = { ...DEFAULT_SETTINGS };
  readonly store = new ReminderStore();
  private ready = false;
  private renderTimer: number | null = null;
  private saveTimer: number | null = null;

  t(key: MessageKey, vars?: Record<string, string | number>): string {
    return tr(this.settings.language || "en", key, vars);
  }

  async onload(): Promise<void> {
    this.settings = sanitizeSettings(await this.loadData());
    // First run: follow the language Obsidian is using.
    if (this.settings.language === "") {
      this.settings.language = detectLanguage(getLanguage());
      await this.saveSettings();
    }
    this.addSettingTab(new ReminderSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_REMINDERS, (leaf) => new ReminderListView(leaf, this));

    this.registerEditorExtension(
      clockButtons({
        openPicker: (view, line) => this.pickInEditor(view, line),
        label: (due) => (due ? this.t("clockEdit", { when: due }) : this.t("clockSet")),
      })
    );
    this.registerMarkdownPostProcessor((el, ctx) => this.addReadingClocks(el, ctx.sourcePath, ctx.getSectionInfo(el)?.lineStart));

    this.addRibbonIcon("alarm-clock", this.t("cmdOpenView"), () => void this.openView(true));
    this.addCommand({ id: "show-reminders", name: this.t("cmdOpenView"), callback: () => void this.openView(true) });
    this.addCommand({
      id: "set-reminder",
      name: this.t("cmdSetHere"),
      editorCallback: (editor) => {
        const line = editor.getCursor().line;
        if (!parseTaskLine(editor.getLine(line))) {
          new Notice(this.t("notTask"));
          return;
        }
        this.openPicker(editor.getLine(line), this.app.workspace.getActiveFile()?.path ?? "", (next) => {
          editor.setLine(line, next);
        });
      },
    });

    this.app.workspace.onLayoutReady(async () => {
      await this.indexAll();
      this.ready = true;
      this.registerEvent(this.app.metadataCache.on("changed", (file, data) => this.index(file, data)));
      this.registerEvent(
        this.app.vault.on("delete", (file) => {
          this.store.delete(file.path);
          this.changed();
        })
      );
      this.registerEvent(
        this.app.vault.on("rename", (file, oldPath) => {
          this.store.rename(oldPath, file.path);
          this.changed();
        })
      );
      this.registerInterval(window.setInterval(() => this.checkDue(), CHECK_EVERY_MS));
      this.checkDue();
      if (this.settings.openOnStart) await this.openView(false);
    });
  }

  onunload(): void {
    if (this.renderTimer !== null) window.clearTimeout(this.renderTimer);
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      void this.saveSettings();
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveSettings();
    }, 2000);
  }

  // ---- index ------------------------------------------------------------------------------------

  private defaultTime(): { hour: number; minute: number } {
    return parseTime(this.settings.defaultTime) ?? { hour: 9, minute: 0 };
  }

  private index(file: TFile, content: string): void {
    if (file.extension !== "md") return;
    const { hour, minute } = this.defaultTime();
    this.store.set(file.path, remindersIn(file.path, content, hour, minute));
    this.changed();
  }

  async indexAll(): Promise<void> {
    for (const file of this.app.vault.getMarkdownFiles()) {
      const items = this.app.metadataCache.getFileCache(file)?.listItems;
      // Only notes with checkboxes need to be read.
      if (items && !items.some((i) => i.task !== undefined)) continue;
      this.index(file, await this.app.vault.cachedRead(file));
    }
    this.changed();
  }

  /** The list and the due check run a moment after the notes change. */
  private changed(): void {
    if (this.renderTimer !== null) return;
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_REMINDERS)) {
        if (leaf.view instanceof ReminderListView) leaf.view.render();
      }
      if (this.ready) this.checkDue();
    }, 200);
  }

  // ---- notifications ------------------------------------------------------------------------------

  private checkDue(): void {
    const now = Date.now();
    let changed = false;
    for (const r of this.store.all()) {
      if (r.due.getTime() > now) break;
      const key = reminderKey(r.path, r.task);
      if (key === "" || this.settings.notified[key] !== undefined) continue;
      this.settings.notified[key] = r.due.getTime();
      changed = true;
      this.notify(r);
    }
    if (changed) {
      this.settings.notified = pruneNotified(this.settings.notified, now);
      this.scheduleSave();
    }
  }

  private notify(r: Reminder): void {
    const body = r.task.text || r.path;
    let shownSystem = false;
    if (this.settings.systemNotification && Platform.isDesktopApp && typeof window.Notification === "function") {
      try {
        const n = new window.Notification(this.t("notifyTitle"), { body });
        n.onclick = () => {
          window.focus();
          void this.openAt(r.path, r.line);
        };
        shownSystem = true;
      } catch {
        shownSystem = false;
      }
    }
    if (this.settings.popup || !shownSystem) new DueModal(this, r).open();
  }

  // ---- editing --------------------------------------------------------------------------------------

  private pickerLabels(): PickerLabels {
    return {
      title: this.t("pickerTitle"),
      date: this.t("pickerDate"),
      time: this.t("pickerTime"),
      noTime: this.t("pickerNoTime"),
      quickIn1h: this.t("quickIn1h"),
      quickTonight: this.t("quickTonight"),
      quickTomorrow: this.t("quickTomorrow"),
      save: this.t("save"),
      remove: this.t("remove"),
      cancel: this.t("cancel"),
      invalidDate: this.t("invalidDate"),
    };
  }

  /** Open the date and time picker for a task line, and hand back the changed line. */
  /**
   * A date-only reminder for today means "some time today". If its notification time has already passed,
   * it is marked as notified right away instead of popping up the moment it is saved.
   */
  private quietIfToday(path: string, line: string): void {
    const { hour, minute } = this.defaultTime();
    const task = parseTaskLine(line, hour, minute);
    if (!task?.due?.allDay || task.due.date !== toDateString(new Date())) return;
    const due = dueTime(task.due).getTime();
    if (due > Date.now()) return;
    this.settings.notified[reminderKey(path, task)] = due;
    this.scheduleSave();
  }

  private openPicker(line: string, path: string, apply: (next: string) => void): void {
    const { hour, minute } = this.defaultTime();
    const task = parseTaskLine(line, hour, minute);
    if (!task) return;
    const initial: PickedTime | null = task.due ? { ...task.due } : null;
    new ReminderPicker(
      this.app,
      this.pickerLabels(),
      initial,
      this.settings.minuteStep,
      (t) => {
        const next = t.allDay ? setReminder(line, t.date, null, null) : setReminder(line, t.date, t.hour, t.minute);
        this.quietIfToday(path, next);
        apply(next);
      },
      task.due ? () => apply(clearReminder(line)) : null
    ).open();
  }

  private pickInEditor(view: EditorView, lineIndex: number): void {
    const line = view.state.doc.line(lineIndex + 1);
    const before = line.text;
    const path = view.state.field(editorInfoField, false)?.file?.path ?? "";
    this.openPicker(before, path, (next) => {
      // The note may have changed while the picker was open; only change the line if it is still the same.
      const now = view.state.doc.line(Math.min(lineIndex + 1, view.state.doc.lines));
      if (now.text !== before) {
        new Notice(this.t("changedMeanwhile"));
        return;
      }
      view.dispatch({ changes: { from: now.from, to: now.to, insert: next } });
    });
  }

  private addReadingClocks(el: HTMLElement, path: string, lineStart: number | undefined): void {
    if (lineStart === undefined) return;
    el.querySelectorAll<HTMLElement>("li.task-list-item").forEach((li) => {
      if (li.dataset.task !== " " && li.dataset.task !== undefined) return;
      const rel = Number(li.dataset.line);
      if (!Number.isFinite(rel)) return;
      const lineNo = lineStart + rel;
      const checkbox = li.querySelector(":scope > input.task-list-item-checkbox");
      if (!checkbox) return;
      const clock = createSpan({ cls: "checkbox-reminder-clock" });
      const r = this.store.all().find((x) => x.path === path && x.line === lineNo);
      if (r) clock.addClass("is-set");
      clock.setAttr("aria-label", r ? this.t("clockEdit", { when: this.whenText(r) }) : this.t("clockSet"));
      setIcon(clock, r ? "alarm-clock-check" : "alarm-clock");
      clock.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this.pickInFile(path, lineNo);
      });
      checkbox.before(clock);
    });
  }

  private whenText(r: Reminder): string {
    const d = r.due;
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return r.task.due?.allDay ? date : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private async pickInFile(path: string, lineNo: number): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    const lines = (await this.app.vault.read(file)).split("\n");
    const before = (lines[lineNo] ?? "").replace(/\r$/, "");
    if (!parseTaskLine(before)) return;
    this.openPicker(before, path, (next) => void this.editLine(path, lineNo, before, () => next));
  }

  /** Change one line of a note, if it still holds `expected` there (or, after edits above it, elsewhere). */
  async editLine(path: string, lineNo: number, expected: string, change: (line: string) => string): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    let ok = false;
    await this.app.vault.process(file, (data) => {
      const lines = data.split("\n");
      const strip = (s: string) => s.replace(/\r$/, "");
      let i = strip(lines[lineNo] ?? "") === expected ? lineNo : lines.findIndex((l) => strip(l) === expected);
      if (i < 0) return data;
      const cr = lines[i].endsWith("\r") ? "\r" : "";
      lines[i] = change(strip(lines[i])) + cr;
      ok = true;
      return lines.join("\n");
    });
    if (!ok) new Notice(this.t("changedMeanwhile"));
  }

  editFromList(r: Reminder): void {
    this.openPicker(r.raw, r.path, (next) => void this.editLine(r.path, r.line, r.raw, () => next));
  }

  async complete(r: Reminder): Promise<void> {
    await this.editLine(r.path, r.line, r.raw, completeTask);
  }

  async snoozeReminder(r: Reminder): Promise<void> {
    await this.editLine(r.path, r.line, r.raw, (line) => snooze(line, new Date(), this.settings.snoozeMinutes));
  }

  async openAt(path: string, line: number): Promise<void> {
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { eState: { line } });
    const view = leaf.view;
    if (view instanceof MarkdownView && view.getMode() === "source") {
      view.editor.setCursor({ line, ch: 0 });
      view.editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
    }
  }

  async openView(focus: boolean): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_REMINDERS)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      await right.setViewState({ type: VIEW_TYPE_REMINDERS, active: focus });
      leaf = right;
    }
    if (focus) await workspace.revealLeaf(leaf);
  }
}

/** The message inside Obsidian when a reminder is due. */
class DueModal extends Modal {
  constructor(private plugin: CheckboxReminderPlugin, private r: Reminder) {
    super(plugin.app);
  }

  onOpen(): void {
    const t = (k: MessageKey, v?: Record<string, string | number>) => this.plugin.t(k, v);
    this.setTitle(t("notifyTitle"));
    this.contentEl.createDiv({ cls: "checkbox-reminder-due-text", text: this.r.task.text || "—" });
    this.contentEl.createDiv({ cls: "checkbox-reminder-due-file", text: this.r.path });
    const buttons = this.contentEl.createDiv({ cls: "modal-button-container" });
    buttons.createEl("button", { text: t("open") }).addEventListener("click", () => {
      void this.plugin.openAt(this.r.path, this.r.line);
      this.close();
    });
    buttons.createEl("button", { text: t("snooze", { n: this.plugin.settings.snoozeMinutes }) }).addEventListener("click", () => {
      void this.plugin.snoozeReminder(this.r);
      this.close();
    });
    buttons.createEl("button", { text: t("done"), cls: "mod-cta" }).addEventListener("click", () => {
      void this.plugin.complete(this.r);
      this.close();
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
