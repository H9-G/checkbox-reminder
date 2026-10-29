import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type CheckboxReminderPlugin from "./main";
import { LANGUAGES, MessageKey } from "./i18n";
import { STEPS, parseTime, sanitizeSettings } from "./settings";

export class ReminderSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: CheckboxReminderPlugin) {
    super(app, plugin);
  }

  getControlValue(key: string): unknown {
    const v = (this.plugin.settings as unknown as Record<string, unknown>)[key];
    return key === "minuteStep" ? String(v) : v;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const v = key === "minuteStep" ? Number(value) : value;
    const next = sanitizeSettings({ ...this.plugin.settings, [key]: v });
    if ((next as unknown as Record<string, unknown>)[key] !== v) return; // invalid input: keep the old value
    this.plugin.settings = next;
    await this.plugin.saveSettings();
    if (key === "language") this.update(); // redraw in the new language
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const t = (k: MessageKey) => this.plugin.t(k);
    return [
      { name: t("language"), desc: t("languageDesc"), control: { type: "dropdown", key: "language", options: { ...LANGUAGES } } },
      { name: t("setNotify"), desc: t("setNotifyDesc"), control: { type: "toggle", key: "systemNotification" } },
      { name: t("setPopup"), desc: t("setPopupDesc"), control: { type: "toggle", key: "popup" } },
      {
        name: t("setDefaultTime"),
        desc: t("setDefaultTimeDesc"),
        control: {
          type: "text",
          key: "defaultTime",
          placeholder: "09:00",
          validate: (v: string) => (parseTime(v) ? undefined : t("setDefaultTimeDesc")),
        },
      },
      {
        name: t("setStep"),
        desc: t("setStepDesc"),
        control: { type: "dropdown", key: "minuteStep", options: Object.fromEntries(STEPS.map((s) => [String(s), String(s)])) },
      },
      {
        name: t("setSnooze"),
        desc: t("setSnoozeDesc"),
        control: { type: "number", key: "snoozeMinutes", min: 1, max: 1440, step: 1 },
      },
      { name: t("setOpenOnStart"), desc: t("setOpenOnStartDesc"), control: { type: "toggle", key: "openOnStart" } },
    ];
  }
}
