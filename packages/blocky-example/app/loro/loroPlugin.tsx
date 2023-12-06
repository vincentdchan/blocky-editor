import { type IPlugin, PluginContext, IBlockDefinition } from "blocky-core";
import { Loro, Frontiers } from "loro-crdt";
import { takeUntil, filter } from "rxjs";
import { isHotkey } from "is-hotkey";
import { LoroBinding } from "./loroBinding";

export function isPrimitive(value: any) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

// FIXME: import from blocky-common
export function isUpperCase(char: string): boolean {
  const codeA = 65;
  const codeZ = 90;
  if (char.length === 0) {
    return false;
  }
  const code = char.charCodeAt(0);
  return code >= codeA && code <= codeZ;
}

class LoroPlugin implements IPlugin {
  name = "loro";
  loro: Loro<Record<string, undefined>>;
  needsInit = true;
  undoStack: Frontiers[] = [];
  redoStack: Frontiers[] = [];
  binding: LoroBinding;
  blocks: IBlockDefinition[] = [];

  constructor(loro?: Loro) {
    if (loro) {
      this.needsInit = false;
    }
    this.loro = loro ?? new Loro();
    this.binding = new LoroBinding(this.loro);
  }

  getInitDocumentByLoro() {
    if (this.needsInit) {
      return undefined;
    }
    const loroMap = this.loro.getMap("document");

    return this.binding.documentFromLoroMap(loroMap);
  }

  onInitialized(context: PluginContext) {
    const { editor } = context;
    this.binding.editorState = editor.state;
    editor.controller.pluginRegistry.unload("undo"); // unload the default undo plugin
    const loro = this.loro;
    const state = context.editor.state;

    const documentMap = loro.getMap("document");

    if (this.needsInit) {
      this.binding.syncDocumentToLoro(state.document, documentMap);
      loro.commit();
    }

    state.changesetApplied2$
      .pipe(
        takeUntil(context.dispose$),
        filter((evt) => evt.options.source !== LoroBinding.source)
      )
      .subscribe(() => {
        loro.commit();
      });

    editor.keyDown$
      .pipe(
        takeUntil(context.dispose$),
        filter((e) => isHotkey("mod+z", e))
      )
      .subscribe((e: KeyboardEvent) => {
        e.preventDefault();
        try {
          this.undo();
        } catch (err) {
          console.error("[Blocky]undo error", err);
          editor.controller.options?.onError?.(err);
        }
      });

    editor.keyDown$
      .pipe(
        takeUntil(context.dispose$),
        filter((e) => isHotkey("mod+shift+z", e))
      )
      .subscribe((e: KeyboardEvent) => {
        e.preventDefault();
        try {
          this.redo(context);
        } catch (err) {
          console.error("[Blocky]redo error", err);
          editor.controller.options?.onError?.(err);
        }
      });

    editor.state.beforeChangesetApply
      .pipe(
        takeUntil(context.dispose$),
        filter((evt) => evt.options.source !== LoroBinding.source)
      )
      .subscribe(() => {
        const frontiers = this.loro.frontiers();
        this.undoStack.push(frontiers);
      });
  }

  undo() {
    const current = this.loro.frontiers();
    const last = this.undoStack.pop();
    if (last) {
      console.log("undo", current, last);
      this.loro.checkout(last);
      this.redoStack.push(current);
    }
  }

  redo(context: PluginContext) {
    console.log("redo", context);
  }
}

export default LoroPlugin;
