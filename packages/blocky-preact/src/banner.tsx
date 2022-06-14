import { render, type ComponentChild } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { type BannerDelegateOptions, type EditorController } from "blocky-core";

export type Renderer = (editorController: EditorController) => ComponentChild;

export function makePreactBannerProvider(renderer: Renderer): BannerDelegateOptions {
  return {
    bannerDidMount(container: HTMLDivElement, editorController: EditorController) {
      render(renderer(editorController), container);
    },
    bannerWillUnmount(container: HTMLDivElement) {
      unmountComponentAtNode(container);
    },
  };
}
