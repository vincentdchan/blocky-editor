import { render, type ComponentChild } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { type ToolbarFactory, type EditorController } from "blocky-core";
import { type IDisposable } from "blocky-common/es/disposable";

export type Renderer = (editorController: EditorController) => ComponentChild;

export function makePreactToolbar(renderer: Renderer): ToolbarFactory {
  return (
    container: HTMLDivElement,
    editorController: EditorController
  ): IDisposable => {
    render(renderer(editorController), container);
    return {
      dispose() {
        unmountComponentAtNode(container);
      },
    };
  };
}
