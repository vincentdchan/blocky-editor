import React, { useEffect, useState, useRef, RefObject } from "react";
import { Editor, EditorController, CursorState } from "blocky-core";

export function useBlockyController(
  generator: () => EditorController | Promise<EditorController>,
  deps?: React.DependencyList | undefined
): EditorController | null {
  const [controller, setController] = useState<EditorController | null>(null);

  useEffect(() => {
    let closed = false;
    const controllerGetter = generator();
    let editorController: EditorController | undefined;
    if (controllerGetter instanceof Promise) {
      controllerGetter
        .then((c) => {
          if (closed) {
            c.dispose();
            return;
          }
          editorController = c;
          setController(editorController);
        })
        .catch((err) => {
          console.error(err);
        });
    } else {
      editorController = controllerGetter;
      setController(editorController);
    }

    return () => {
      closed = true;
      editorController?.dispose();
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

  scrollContainer?: RefObject<HTMLElement>;
}

export function BlockyEditor(props: Props) {
  const { controller, autoFocus, ignoreInitEmpty, scrollContainer } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!controller) {
      return;
    }
    const editor = Editor.fromController(containerRef.current!, controller);
    if (ignoreInitEmpty !== true) {
      editor.initFirstEmptyBlock();
    }

    if (scrollContainer) {
      editor.scrollContainer = scrollContainer.current!;
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
  }, [controller, autoFocus, ignoreInitEmpty, scrollContainer]);

  if (!controller) {
    return null;
  }
  return <div className="blocky-editor-container" ref={containerRef}></div>;
}
