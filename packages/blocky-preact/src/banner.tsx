import { render, type ComponentChild } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { type BannerProvider, type EditorController } from "blocky-core";
import { type IDisposable } from "blocky-common/src/disposable";

export type Renderer = (editorController: EditorController) => ComponentChild;

export function makePreactBannerProvider(renderer: Renderer): BannerProvider {
  return {
    bannerDidMount(container: HTMLDivElement, editorController: EditorController): IDisposable {
      render(renderer(editorController), container);
      return {
        dispose() {
          unmountComponentAtNode(container);
        }
      };
    },
  };
}
