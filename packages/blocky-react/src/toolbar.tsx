import { render, type ComponentChild } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import {
  type ToolbarFactory,
  type EditorController,
  type Toolbar,
} from "blocky-core";

export type Renderer = (editorController: EditorController) => ComponentChild;

export function makePreactToolbar(
  renderer: Renderer,
  options?: { yOffset?: number }
): ToolbarFactory {
  return (
    container: HTMLDivElement,
    editorController: EditorController
  ): Toolbar => {
    render(renderer(editorController), container);
    return {
      dispose() {
        unmountComponentAtNode(container);
      },
      yOffset: options?.yOffset,
    };
  };
}
