import { render, type ComponentChild } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { type BannerDelegateOptions, type Editor } from "blocky-core";

export type Renderer = (editor: Editor) => ComponentChild;

export function makePreactBannerOptions(renderer: Renderer): BannerDelegateOptions {
  return {
    bannerDidMount(container: HTMLDivElement, editor: Editor) {
      render(renderer(editor), container);
    },
    bannerWillUnmount(container: HTMLDivElement) {
      unmountComponentAtNode(container);
    },
  };
}
