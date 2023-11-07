import React from "react";
import { createRoot } from "react-dom/client";
import type { BlockElement } from "blocky-data";
import type {
  BannerFactory,
  EditorController,
  BannerInstance,
} from "blocky-core";

export interface RenderProps {
  editorController: EditorController;
  focusedNode?: BlockElement;
}

export type Renderer = (props: RenderProps) => React.ReactNode;

export function makeReactBanner(renderer: Renderer): BannerFactory {
  return (
    container: HTMLDivElement,
    editorController: EditorController
  ): BannerInstance => {
    let focusedNode: BlockElement | undefined;
    const root = createRoot(container);
    const renderFn = () => {
      root.render(renderer({ editorController, focusedNode }));
    };
    renderFn();
    return {
      onFocusedNodeChanged(n: BlockElement) {
        focusedNode = n;
        renderFn();
      },
      dispose() {
        root.unmount();
      },
    };
  };
}
