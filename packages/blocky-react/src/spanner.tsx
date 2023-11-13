import React from "react";
import { createRoot } from "react-dom/client";
import type {
  SpannerFactory,
  EditorController,
  SpannerInstance,
  BlockDataElement,
} from "blocky-core";
import { once } from "lodash-es";

export interface RenderProps {
  editorController: EditorController;
  focusedNode?: BlockDataElement;
}

export type Renderer = (props: RenderProps) => React.ReactNode;

export function makeReactSpanner(renderer: Renderer): SpannerFactory {
  return (
    container: HTMLDivElement,
    editorController: EditorController
  ): SpannerInstance => {
    let focusedNode: BlockDataElement | undefined;
    const root = createRoot(container);
    const renderFn = () => {
      root.render(renderer({ editorController, focusedNode }));
    };
    renderFn();
    return {
      onFocusedNodeChanged(n: BlockDataElement) {
        focusedNode = n;
        renderFn();
      },
      dispose: once(() => {
        setTimeout(() => {
          root.unmount();
        }, 0);
      }),
    };
  };
}
