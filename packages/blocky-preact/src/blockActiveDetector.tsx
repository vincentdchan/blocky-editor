import { type CursorStateUpdateEvent } from "blocky-data";
import { type EditorController, type CursorChangedEvent } from "blocky-core";
import { useEffect, useState, useRef } from "preact/hooks";

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
    const disposable = controller.state.cursorStateChanged.on(
      (e: CursorStateUpdateEvent) => {
        cursorUpdateHandler.current!(e);
      }
    );
    return () => disposable.dispose();
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
    const disposable = controller.beforeApplyCursorChanged.on(
      (evt: CursorChangedEvent) => {
        applyCursorChangedEventHandler.current!(evt);
      }
    );
    return () => disposable.dispose();
  }, [controller]);

  return collaborativeOutlineColor;
}
