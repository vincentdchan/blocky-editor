import React, {
  useState,
  useEffect,
  memo,
  useCallback,
  useContext,
} from "react";
import { BlockDataElement, Changeset } from "blocky-core";
import { DefaultBlockOutline, ReactBlockContext, useBlockActive } from "../../";
import ImageBlockContent from "./imageBlockContent";
import { css } from "@emotion/react";
import { isNumber } from "lodash-es";

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
  minWidth: number;
  blockElement: BlockDataElement;
  placeholder: ImageBlockPlaceholderRenderer;
}

const ImageBlock = memo(
  ({ blockElement, placeholder, minWidth }: ImageBlockProps) => {
    const active = useBlockActive();
    const [hover, setHover] = useState(false);
    const [data, setData] = useState<string | undefined>(
      blockElement.getAttribute("src")
    );
    const ctx = useContext(ReactBlockContext)!;
    const controller = ctx.editorController;
    const setBlockWidth = useCallback(
      (width?: number) => {
        if (isNumber(width)) {
          ctx.blockContainer.style.width = `${width}px`;
        } else {
          ctx.blockContainer.style.removeProperty("width");
        }
      },
      [ctx.blockContainer]
    );

    useEffect(() => {
      setData(blockElement.getAttribute("src"));

      const s = blockElement.changed.subscribe((e) => {
        if (e.type !== "element-set-attrib") {
          return;
        }
        if (e.key === "width") {
          setBlockWidth(Number(e.value));
        } else if (e.key === "src") {
          setData(e.value);
        }
      });

      return () => {
        s.unsubscribe();
      };
    }, [blockElement]);

    const setSrc = useCallback(
      (newSrc: string) => {
        const element = controller.state.getBlockElementById(ctx.blockId);
        if (!element) {
          return;
        }

        new Changeset(controller.state)
          .updateAttributes(element, {
            src: newSrc,
          })
          .apply();
      },
      [controller, ctx.blockId]
    );

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
              setSrc: setSrc,
            })
          ) : (
            <ImageBlockContent
              active={active}
              hover={hover}
              src={data}
              minWidth={minWidth}
              setWidth={setBlockWidth}
            />
          )}
        </div>
      </DefaultBlockOutline>
    );
  }
);

ImageBlock.displayName = "ImageBlock";

export default ImageBlock;
