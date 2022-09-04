import { type CursorStateUpdateEvent } from "blocky-data";
import { type EditorController, type CursorChangedEvent } from "blocky-core";
import { useCallback, useEffect, useState } from "preact/hooks";

export interface BlockActiveDetectorProps {
  controller: EditorController;
  blockId: string;
}

export function useBlockActive(props: BlockActiveDetectorProps): boolean {
  const [active, setActive] = useState<boolean>(false);

  const { controller, blockId } = props;

  const handleNewCursorState = useCallback(
    (evt: CursorStateUpdateEvent) => {
      const { state } = evt;
      const nextActive =
        state !== null && state.isCollapsed && state.id === blockId;

      setActive(nextActive);
    },
    [blockId, active]
  );

  useEffect(() => {
    const disposable =
      controller.state.cursorStateChanged.on(handleNewCursorState);
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
  const handleApplyCursorChangedEvent = useCallback(
    (evt: CursorChangedEvent) => {
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
    },
    [controller, blockId]
  );

  useEffect(() => {
    const disposable = controller.beforeApplyCursorChanged.on(
      handleApplyCursorChangedEvent
    );
    return () => disposable.dispose();
  }, [controller]);

  return collaborativeOutlineColor;
}
