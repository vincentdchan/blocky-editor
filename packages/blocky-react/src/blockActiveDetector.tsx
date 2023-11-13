import { useEffect, useState, useRef } from "react";
import {
  type EditorController,
  type CursorChangedEvent,
  type CursorStateUpdateEvent,
} from "blocky-core";

export interface BlockActiveDetectorProps {
  controller: EditorController;
  blockId: string;
}

export function useBlockActive(props: BlockActiveDetectorProps): boolean {
  const [active, setActive] = useState<boolean>(false);
  const cursorUpdateHandler = useRef<
    ((e: CursorStateUpdateEvent) => void) | undefined
  >(undefined);

  const { controller, blockId } = props;

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

export function useCollaborativeOutlineColor(
  props: BlockActiveDetectorProps
): string | undefined {
  const [collaborativeOutlineColor, setCollaborativeOutlineColor] = useState<
    string | undefined
  >(undefined);
  const { controller, blockId } = props;
  const applyCursorChangedEventHandler = useRef<
    ((e: CursorChangedEvent) => void) | undefined
  >(undefined);

  useEffect(() => {
    applyCursorChangedEventHandler.current = (evt: CursorChangedEvent) => {
      const { state } = evt;
      const shouldShowOutline =
        state !== null && state.isCollapsed && state.id === props.blockId;

      const { controller } = props;
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
