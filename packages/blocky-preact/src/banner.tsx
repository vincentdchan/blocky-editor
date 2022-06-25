import { render, type ComponentChild } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { type BlockElement, type BannerFactory, type EditorController, type BannerInstance } from "blocky-core";

export interface RenderProps {
  editorController: EditorController;
  focusedNode?: BlockElement;
}

export type Renderer = (props: RenderProps) => ComponentChild;

export function makePreactBanner(renderer: Renderer): BannerFactory {
  return (
    container: HTMLDivElement,
    editorController: EditorController
  ): BannerInstance => {
    let focusedNode: BlockElement | undefined;
    const renderFn = () => {
      render(renderer({ editorController, focusedNode }), container);
    }
    renderFn();
    return {
      onFocusedNodeChanged(n: BlockElement) {
        focusedNode = n;
        renderFn();
      },
      dispose() {
        unmountComponentAtNode(container);
      },
    };
  };
}
