import { useState, useRef, useEffect, memo } from "react";
import {
  type TryParsePastedDOMEvent,
  type IPlugin,
  BlockDataElement,
} from "blocky-core";
import {
  makeReactBlock,
  DefaultBlockOutline,
  type ReactBlockRenderProps,
} from "blocky-react";
import Button from "@pkg/components/button";
import "./imageBlock.scss";

export const ImageBlockName = "Image";

interface ImageBlockProps {
  blockElement: BlockDataElement;
}

const ImageBlock = memo(({ blockElement }: ImageBlockProps) => {
  const selectorRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<string | undefined>(
    blockElement.getAttribute("src")
  );

  const handleUpload = () => {
    selectorRef.current?.click();
  };

  useEffect(() => {
    setData(blockElement.getAttribute("src"));
  }, [blockElement]);

  const handleSelectedFileChanged = () => {
    const files = selectorRef.current?.files;
    if (!files || files.length === 0) {
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      setData(fr.result as string);
    };
    fr.readAsDataURL(files[0]);
  };

  const renderBlockContent = () => {
    if (typeof data === "undefined") {
      return (
        <>
          <Button onClick={handleUpload}>Upload</Button>
          <input
            type="file"
            accept=".jpg, .png, .jpeg, .gif, .bmp, .tif, .tiff|image/*"
            className="blocky-image-block-file-selector"
            onChange={handleSelectedFileChanged}
            ref={selectorRef}
          />
        </>
      );
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

export function makeImageBlockPlugin(): IPlugin {
  return {
    name: ImageBlockName,
    blocks: [
      makeReactBlock({
        name: ImageBlockName,
        component: (props: ReactBlockRenderProps) => (
          <ImageBlock blockElement={props.blockElement} />
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
