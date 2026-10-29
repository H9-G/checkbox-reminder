// The clock button in front of every open checkbox in the editor.
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { setIcon } from "obsidian";
import { parseTaskLine } from "./format";

export interface ClockHost {
  /** Called with the editor and the 0-based line whose clock was pressed. */
  openPicker(view: EditorView, line: number): void;
  label(due: string | null): string;
}

const OPEN_TASK = /^(\s*)(?:[-*+]|\d+[.)])\s+\[ \]/;

class ClockWidget extends WidgetType {
  constructor(private host: ClockHost, private due: string | null) {
    super();
  }

  eq(other: ClockWidget): boolean {
    return other.due === this.due;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = createSpan({ cls: "checkbox-reminder-clock" + (this.due ? " is-set" : "") });
    el.setAttr("aria-label", this.host.label(this.due));
    el.setAttr("role", "button");
    setIcon(el, this.due ? "alarm-clock-check" : "alarm-clock");
    el.addEventListener("mousedown", (e) => e.preventDefault());
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const pos = view.posAtDOM(el);
      this.host.openPicker(view, view.state.doc.lineAt(pos).number - 1);
    });
    return el;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export function clockButtons(host: ClockHost) {
  const build = (view: EditorView): DecorationSet => {
    const b = new RangeSetBuilder<Decoration>();
    for (const { from, to } of view.visibleRanges) {
      let pos = from;
      while (pos <= to) {
        const line = view.state.doc.lineAt(pos);
        const m = OPEN_TASK.exec(line.text);
        if (m) {
          const task = parseTaskLine(line.text);
          const d = task?.due;
          const due = d ? (d.allDay ? d.date : `${d.date} ${String(d.hour).padStart(2, "0")}:${String(d.minute).padStart(2, "0")}`) : null;
          b.add(line.from + m[1].length, line.from + m[1].length, Decoration.widget({ widget: new ClockWidget(host, due), side: -1 }));
        }
        pos = line.to + 1;
      }
    }
    return b.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
      }
    },
    { decorations: (v) => v.decorations }
  );
}
