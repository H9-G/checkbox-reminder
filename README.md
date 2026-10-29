# Checkbox Reminder

**English** | [日本語](docs/README.ja.md) | [简体中文](docs/README.zh-CN.md) | [繁體中文](docs/README.zh-TW.md) | [한국어](docs/README.ko.md) | [Español](docs/README.es.md) | [Français](docs/README.fr.md) | [Deutsch](docs/README.de.md)

Set a reminder on any checkbox with a clock button, a calendar and time menus. Get a desktop notification when it is due, and see all reminders by due date in the sidebar.

## Features

- A **clock button** appears to the left of every open checkbox, in editing view and in reading view. Press it to pick a **date with a calendar** and a **time with menus** (hours and minutes). Quick buttons: in 1 hour, tonight 20:00, tomorrow 9:00.
- Tick **No time** to save a date only. The reminder then comes at the default time (09:00 unless changed). A date-only reminder for today does not pop up right away.
- The reminder is written into the task as plain text, so the note stays readable without the plugin:

  ```
  - [ ] Buy milk ⏰ 2026-10-26 09:00
  ```

- When the time comes, a **desktop notification** appears (Windows, macOS, Linux). Click it to open the note. A message inside Obsidian can be shown as well, with **Done**, **Snooze** and **Open**.
- The **reminder list** in the right sidebar shows every open reminder of the vault, earliest first, under Overdue, Today, Tomorrow, Next 7 days and Later. Tick a reminder to finish the task, press its clock to change the time, or click it to open the note.
- Reminders that came due while Obsidian was closed are shown the next time it starts.
- The settings, commands and messages are available in English, Japanese, Simplified Chinese, Traditional Chinese, Korean, Spanish, French and German. The language follows Obsidian on first use and can be changed in the settings.

## Good to know

- Notifications need Obsidian to be running. On phones and tablets there are no system notifications; a message is shown inside Obsidian while it is open.
- Finishing a reminder from the list or the message ticks the checkbox in the note.

## Network use

None. The plugin works offline and collects no data.

## License

MIT
