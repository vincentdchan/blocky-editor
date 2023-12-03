import React from "react";
import { createRoot } from "react-dom/client";
import {
  type ToolbarFactory,
  type EditorController,
  type Toolbar,
} from "blocky-core";
import { once } from "lodash-es";
import { DefaultToolbarMenu } from "./defaultToolbar";
import { ThemeWrapper } from "./reactTheme";

export type Renderer = (editorController: EditorController) => React.ReactNode;

export function makeReactToolbar(
  renderer: Renderer,
  options?: { yOffset?: number }
): ToolbarFactory {
  return (
    container: HTMLDivElement,
    editorController: EditorController
  ): Toolbar => {
    const root = createRoot(container);
    root.render(
      <ThemeWrapper editorController={editorController}>
        {renderer(editorController)}
      </ThemeWrapper>
    );
    return {
      dispose: once(() => {
        setTimeout(() => {
          root.unmount();
        }, 0);
      }),
      yOffset: options?.yOffset,
    };
  };
}

export function makeDefaultReactToolbar() {
  return makeReactToolbar((editorController: EditorController) => {
    return <DefaultToolbarMenu editorController={editorController} />;
  });
}
