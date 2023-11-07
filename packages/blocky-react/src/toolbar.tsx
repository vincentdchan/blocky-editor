import React from "react";
import { createRoot } from "react-dom/client";
import {
  type ToolbarFactory,
  type EditorController,
  type Toolbar,
} from "blocky-core";

export type Renderer = (editorController: EditorController) => React.ReactNode;

export function makePreactToolbar(
  renderer: Renderer,
  options?: { yOffset?: number }
): ToolbarFactory {
  return (
    container: HTMLDivElement,
    editorController: EditorController
  ): Toolbar => {
    const root = createRoot(container);
    root.render(renderer(editorController));
    return {
      dispose() {
        root.unmount();
      },
      yOffset: options?.yOffset,
    };
  };
}
