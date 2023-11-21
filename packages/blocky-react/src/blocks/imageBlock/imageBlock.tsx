import React, { useState, useEffect, memo } from "react";
import { BlockDataElement } from "blocky-core";
import { DefaultBlockOutline } from "../../";
import ImageBlockContent from "./imageBlockContent";
import { css } from "@emotion/react";

const imageBlockStyle = css({
  backgroundColor: "rgb(237, 237, 235)",
  minHeight: "80px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

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

  return (
    <DefaultBlockOutline>
      <div css={imageBlockStyle}>
        {typeof data === "undefined" ? (
          placeholder({
            setSrc: setData,
          })
        ) : (
          <ImageBlockContent src={data} />
        )}
      </div>
    </DefaultBlockOutline>
  );
});

ImageBlock.displayName = "ImageBlock";

export default ImageBlock;
