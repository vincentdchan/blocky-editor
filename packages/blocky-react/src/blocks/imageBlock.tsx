import React, { useState, useEffect, memo } from "react";
import {
  type TryParsePastedDOMEvent,
  type IPlugin,
  BlockDataElement,
} from "blocky-core";
import {
  makeReactBlock,
  DefaultBlockOutline,
  type ReactBlockRenderProps,
} from "../";
// import Button from "@pkg/components/button";
// import "./imageBlock.scss";

export const ImageBlockName = "Image";

export type ImageBlockPlaceholderRenderer = (props: {
  setSrc: (src: string) => void;
}) => React.ReactNode;

interface ImageBlockProps {
  blockElement: BlockDataElement;
  placeholder: ImageBlockPlaceholderRenderer;
}

const ImageBlock = memo(({ blockElement, placeholder }: ImageBlockProps) => {
  const [data, setData] = useState<string | undefined>(
    blockElement.getAttribute("src")
  );

  useEffect(() => {
    setData(blockElement.getAttribute("src"));
  }, [blockElement]);

  const renderBlockContent = () => {
    if (typeof data === "undefined") {
      return placeholder({
        setSrc: setData,
      });
    }

    return <img src={data} alt="" />;
  };

  return (
    <DefaultBlockOutline>
      <div className="blocky-image-block">{renderBlockContent()}</div>
    </DefaultBlockOutline>
  );
});

ImageBlock.displayName = "ImageBlock";

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
