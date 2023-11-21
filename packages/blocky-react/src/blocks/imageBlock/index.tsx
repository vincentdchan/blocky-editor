import ImageBlock, { ImageBlockPlaceholderRenderer } from "./imageBlock";
import {
  type TryParsePastedDOMEvent,
  type IPlugin,
  BlockDataElement,
} from "blocky-core";
import { makeReactBlock, type ReactBlockRenderProps } from "../../";

export const ImageBlockName = "Image";

export interface ImageBlockOptions {
  placeholder: ImageBlockPlaceholderRenderer;
}

export function makeImageBlockPlugin(options: ImageBlockOptions): IPlugin {
  const { placeholder } = options;
  return {
    name: ImageBlockName,
    blocks: [
      makeReactBlock({
        name: ImageBlockName,
        component: (props: ReactBlockRenderProps) => (
          <ImageBlock
            blockElement={props.blockElement}
            placeholder={placeholder}
          />
        ),
        tryParsePastedDOM(e: TryParsePastedDOMEvent) {
          const { node, editorController } = e;
          const img = node.querySelector("img");
          if (img) {
            const newId = editorController.idGenerator.mkBlockId();
            const src = img.getAttribute("src");
            let attributes: object | undefined;
            if (src) {
              attributes = {
                src: src,
              };
            }
            const element = new BlockDataElement(
              ImageBlockName,
              newId,
              attributes
            );
            return element;
          }
        },
      }),
    ],
  };
}
