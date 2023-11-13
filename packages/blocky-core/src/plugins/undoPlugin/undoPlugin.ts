import { type IPlugin } from "@pkg/registry/pluginRegistry";
import { takeUntil, filter } from "rxjs";
import { isHotkey } from "is-hotkey";
import { debounce } from "lodash-es";
import { UndoManager } from "./undoManager";
import { ChangesetRecordOption, FinalizedChangeset } from "@pkg/data";

function makeUndoPlugin(): IPlugin {
  return {
    name: "undo",
    onInitialized(context) {
      const editor = context.editor;
      const undoManager = new UndoManager(editor.state);

      const debouncedSealUndo = debounce(() => {
        undoManager.seal();
      }, 1000);

      editor.keyDown$
        .pipe(
          takeUntil(context.dispose$),
          filter((e) => isHotkey("mod+z", e))
        )
        .subscribe((e: KeyboardEvent) => {
          e.preventDefault();
          try {
            undoManager.undo();
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
            undoManager.redo();
          } catch (err) {
            console.error("[Blocky]redo error", err);
            editor.controller.options?.onError?.(err);
          }
        });

      editor.contentChanged$.pipe(takeUntil(context.dispose$)).subscribe(() => {
        debouncedSealUndo();
      });

      editor.state.changesetApplied
        .pipe(takeUntil(context.dispose$))
        .subscribe((changeset: FinalizedChangeset) => {
          const { options } = changeset;
          const isThisUser = changeset.userId === editor.controller.userId;
          if (options.record === ChangesetRecordOption.Undo && isThisUser) {
            const undoItem = undoManager.getAUndoItem();
            if (undoItem.startVersion < 0) {
              undoItem.startVersion = changeset.version;
              undoItem.length = 1;
            } else {
              undoItem.length = 1 + (changeset.version - undoItem.startVersion);
            }
            undoManager.clearRedoStack();
            debouncedSealUndo();
          } else if (
            options.record === ChangesetRecordOption.Redo &&
            isThisUser
          ) {
            undoManager.pushRedoItem(changeset);
          } else {
            // applying changeset from another user
            undoManager.seal();
          }
        });

      editor.compositionStart$
        .pipe(takeUntil(context.dispose$))
        .subscribe(() => {
          undoManager.cursorBeforeComposition = editor.state.cursorState;
        });

      editor.compositionEnd$.pipe(takeUntil(context.dispose$)).subscribe(() => {
        undoManager.cursorBeforeComposition = null;
      });
    },
  };
}

export default makeUndoPlugin;
