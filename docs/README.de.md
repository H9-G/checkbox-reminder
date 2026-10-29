# Checkbox Reminder

[English](../README.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [한국어](README.ko.md) | [Español](README.es.md) | [Français](README.fr.md) | **Deutsch**

Setze mit einer Uhr-Schaltfläche, einem Kalender und Uhrzeitmenüs eine Erinnerung an jedes Kontrollkästchen. Erhalte eine Desktop-Benachrichtigung, wenn sie fällig ist, und sieh alle Erinnerungen nach Fälligkeit in der Seitenleiste.

## Funktionen

- Links neben jedem offenen Kontrollkästchen erscheint eine **Uhr-Schaltfläche**, in der Bearbeitungs- und in der Leseansicht. Ein Klick öffnet die Auswahl des **Datums per Kalender** und der **Uhrzeit per Menü** (Stunden und Minuten). Schnellwahl: in 1 Stunde, heute Abend 20:00, morgen 9:00.
- Mit **Ohne Uhrzeit** wird nur das Datum gespeichert. Die Erinnerung kommt dann zur Standardzeit (09:00, sofern nicht geändert). Eine Erinnerung nur mit dem heutigen Datum erscheint nicht sofort.
- Die Erinnerung wird als normaler Text in die Aufgabe geschrieben, die Notiz bleibt also auch ohne das Plugin lesbar:

  ```
  - [ ] Milch kaufen ⏰ 2026-10-26 09:00
  ```

- Zur angegebenen Zeit erscheint eine **Desktop-Benachrichtigung** (Windows, macOS, Linux). Ein Klick öffnet die Notiz. Zusätzlich kann eine Meldung in Obsidian erscheinen, mit **Erledigt**, **Später erinnern** und **Öffnen**.
- Die **Erinnerungsliste** in der rechten Seitenleiste zeigt alle offenen Erinnerungen des Vaults, die früheste zuerst, unter Überfällig, Heute, Morgen, Nächste 7 Tage und Später. Hake eine Erinnerung ab, um die Aufgabe zu erledigen, drücke auf ihre Uhr, um die Zeit zu ändern, oder klicke sie an, um die Notiz zu öffnen.
- Erinnerungen, die fällig wurden, während Obsidian geschlossen war, werden beim nächsten Start angezeigt.
- Einstellungen, Befehle und Meldungen gibt es auf Englisch, Japanisch, vereinfachtem Chinesisch, traditionellem Chinesisch, Koreanisch, Spanisch, Französisch und Deutsch. Die Sprache folgt beim ersten Start Obsidian und lässt sich in den Einstellungen ändern.

## Gut zu wissen

- Benachrichtigungen setzen voraus, dass Obsidian läuft. Auf Smartphones und Tablets gibt es keine Systembenachrichtigungen; stattdessen erscheint eine Meldung in Obsidian, solange es geöffnet ist.
- Wird eine Erinnerung in der Liste oder der Meldung erledigt, wird auch das Kontrollkästchen in der Notiz abgehakt.

## Zugriff auf den Vault

Um deine Erinnerungen zu finden, geht das Plugin die Liste der Notizen im Vault durch und liest die Notizen, die Kontrollkästchen enthalten. Es sucht nur nach Zeilen mit einem Kontrollkästchen und einem ⏰-Datum. Es wird nichts gesendet; alles bleibt auf deinem Gerät.

## Netzwerknutzung

Keine. Das Plugin arbeitet offline und sammelt keine Daten.

## Lizenz

MIT
