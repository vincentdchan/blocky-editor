import React from "react";
import { createRoot, Root } from "react-dom/client";
import type {
  SpannerFactory,
  EditorController,
  SpannerInstance,
  BlockDataElement,
  SpannerDelegate,
} from "blocky-core";
import { once } from "lodash-es";
import { DefaultSpannerMenu, MenuCommand } from "./defaultSpannerMenu";
import { ThemeWrapper } from "./reactTheme";

export interface RenderProps {
  editorController: EditorController;
  focusedNode?: BlockDataElement;
  uiDelegate: SpannerDelegate;
}

export type Renderer = (props: RenderProps) => React.ReactNode;

export function makeReactSpanner(renderer: Renderer): SpannerFactory {
  return (
    container: HTMLDivElement,
    editorController: EditorController,
    uiDelegate: SpannerDelegate
  ): SpannerInstance => {
    let focusedNode: BlockDataElement | undefined;
    let root: Root | null = createRoot(container);
    const renderFn = () => {
      root?.render(
        <ThemeWrapper editorController={editorController}>
          {renderer({ editorController, focusedNode, uiDelegate })}
        </ThemeWrapper>
      );
    };
    renderFn();
    return {
      onFocusedNodeChanged(n: BlockDataElement) {
        focusedNode = n;
        renderFn();
      },
      dispose: once(() => {
        setTimeout(() => {
          root?.unmount();
          root = null;
        }, 0);
      }),
    };
  };
}

export interface DefaultSpannerOptions {
  commands?: MenuCommand[];
}

export function makeDefaultReactSpanner(options?: DefaultSpannerOptions) {
  return makeReactSpanner(({ editorController, focusedNode, uiDelegate }) => {
    return (
      <DefaultSpannerMenu
        editorController={editorController}
        focusedNode={focusedNode}
        uiDelegate={uiDelegate}
        commands={options?.commands}
      />
    );
  });
}
