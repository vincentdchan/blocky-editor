import { useEffect, useState, useRef, useContext } from "react";
import {
  type CursorChangedEvent,
  type CursorStateUpdateEvent,
} from "blocky-core";
import { ReactBlockContext } from "./reactBlock";

export function useBlockActive(): boolean {
  const ctx = useContext(ReactBlockContext)!;
  const [active, setActive] = useState<boolean>(false);
  const cursorUpdateHandler = useRef<
    ((e: CursorStateUpdateEvent) => void) | undefined
  >(undefined);

  const { editorController: controller, blockId } = ctx;

  useEffect(() => {
    cursorUpdateHandler.current = (evt: CursorStateUpdateEvent) => {
      const { state } = evt;
      const nextActive =
        state !== null && state.isCollapsed && state.id === blockId;

      if (nextActive === active) {
        return;
      }
      setActive(nextActive);
    };
  }, [blockId, active]);

  useEffect(() => {
    const s = controller.state.cursorStateChanged.subscribe(
      (e: CursorStateUpdateEvent) => {
        cursorUpdateHandler.current!(e);
      }
    );
    return () => s.unsubscribe();
  }, [controller]);

  return active;
}

export function useCollaborativeOutlineColor(): string | undefined {
  const ctx = useContext(ReactBlockContext)!;
  const [collaborativeOutlineColor, setCollaborativeOutlineColor] = useState<
    string | undefined
  >(undefined);
  const { editorController: controller, blockId } = ctx;
  const applyCursorChangedEventHandler = useRef<
    ((e: CursorChangedEvent) => void) | undefined
  >(undefined);

  useEffect(() => {
    applyCursorChangedEventHandler.current = (evt: CursorChangedEvent) => {
      const { state } = evt;
      const { editorController: controller, blockId } = ctx;
      const shouldShowOutline =
        state !== null && state.isCollapsed && state.id === blockId;

      const { editor } = controller;
      if (!editor) {
        return;
      }
      if (shouldShowOutline) {
        const cursor = editor.collaborativeCursorManager.getOrInit(evt.id);
        setCollaborativeOutlineColor(cursor.client.color);
      } else {
        setCollaborativeOutlineColor(undefined);
      }
    };
  }, [controller, blockId]);

  useEffect(() => {
    const s = controller.beforeApplyCursorChanged.subscribe(
      (evt: CursorChangedEvent) => {
        applyCursorChangedEventHandler.current!(evt);
      }
    );
    return () => s.unsubscribe();
  }, [controller]);

  return collaborativeOutlineColor;
}
