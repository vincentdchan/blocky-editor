import { type CursorStateUpdateEvent } from "blocky-data";
import { type EditorController, type CursorChangedEvent } from "blocky-core";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import { useCallback, useEffect, useState } from "preact/hooks";

export interface BlockActiveResult {
  active: boolean;
  collaborativeOutlineColor?: string;
}

export interface BlockActiveDetectorProps {
  controller: EditorController;
  blockId: string;
}

export function useBlockActive(
  props: BlockActiveDetectorProps
): BlockActiveResult {
  const [active, setActive] = useState<boolean>(false);
  const [collaborativeOutlineColor, setCollaborativeOutlineColor] = useState<
    string | undefined
  >(undefined);

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
    const disposables: IDisposable[] = [
      controller.state.cursorStateChanged.on(handleNewCursorState),
      controller.beforeApplyCursorChanged.on(handleApplyCursorChangedEvent),
    ];
    return () => flattenDisposable(disposables).dispose();
  }, [controller]);

  return { active, collaborativeOutlineColor };
}
