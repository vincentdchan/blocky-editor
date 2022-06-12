import { render, type ComponentChild } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { BannerDelegateOptions } from "blocky-core";

export function makePreactBannerOptions(vnode: ComponentChild): BannerDelegateOptions {
  return {
    bannerDidMount(container: HTMLDivElement) {
      render(vnode, container);
    },
    bannerWillUnmount(container: HTMLDivElement) {
      unmountComponentAtNode(container);
    },
  };
}
