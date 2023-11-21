import React, {
  useState,
  useEffect,
  memo,
  useContext,
  useCallback,
} from "react";
import { BlockDataElement } from "blocky-core";
import { DefaultBlockOutline, ReactBlockContext, useBlockActive } from "../../";
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
  const blockContext = useContext(ReactBlockContext)!;
  const active = useBlockActive({
    controller: blockContext.editorController,
    blockId: blockContext.blockId,
  });
  const [hover, setHover] = useState(false);
  const [data, setData] = useState<string | undefined>(
    blockElement.getAttribute("src")
  );

  useEffect(() => {
    setData(blockElement.getAttribute("src"));
  }, [blockElement]);

  const handleMouseEnter = useCallback(() => setHover(true), []);

  const handleMouseLeave = useCallback(() => setHover(false), []);

  return (
    <DefaultBlockOutline>
      <div
        css={imageBlockStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {typeof data === "undefined" ? (
          placeholder({
            setSrc: setData,
          })
        ) : (
          <ImageBlockContent active={active} hover={hover} src={data} />
        )}
      </div>
    </DefaultBlockOutline>
  );
});

ImageBlock.displayName = "ImageBlock";

export default ImageBlock;
