import React, { useEffect, useState, useRef } from "react";
import { Editor, EditorController, CursorState } from "blocky-core";

export function useBlockyController(
  generator: () => EditorController,
  deps?: React.DependencyList | undefined
): EditorController | null {
  const [controller, setController] = useState<EditorController | null>(null);

  useEffect(() => {
    const controller = generator();
    setController(controller);

    return () => {
      controller.dispose();
    };
  }, deps);

  return controller;
}

export interface Props {
  controller: EditorController | null;

  /**
   * If this flag is false,
   * the editor will not create an empty
   * block automatically when the editor is created.
   */
  ignoreInitEmpty?: boolean;

  autoFocus?: boolean;
}

export function BlockyEditor(props: Props) {
  const { controller, autoFocus, ignoreInitEmpty } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!controller) {
      return;
    }
    const editor = Editor.fromController(containerRef.current!, controller);
    if (ignoreInitEmpty !== true) {
      editor.initFirstEmptyBlock();
    }
    editor.fullRender(() => {
      if (autoFocus) {
        if (controller.state.document.title) {
          controller.setCursorState(CursorState.collapse("title", 0));
        } else {
          controller.focus();
        }
      }
    });

    return () => {
      editor.dispose();
    };
  }, [controller, autoFocus, ignoreInitEmpty]);

  if (!controller) {
    return null;
  }
  return <div className="blocky-editor-container" ref={containerRef}></div>;
}
