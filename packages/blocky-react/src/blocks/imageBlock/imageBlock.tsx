import React, { useState, useEffect, memo } from "react";
import { BlockDataElement } from "blocky-core";
import { DefaultBlockOutline } from "../../";
import { css } from "@emotion/react";

const imageBlockStyle = css({
  backgroundColor: "rgb(237, 237, 235)",
  minHeight: "80px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  img: {
    maxWidth: "100%",
  },
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
      <div css={imageBlockStyle}>{renderBlockContent()}</div>
    </DefaultBlockOutline>
  );
});

ImageBlock.displayName = "ImageBlock";

export default ImageBlock;
