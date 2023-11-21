import { memo, useContext, useEffect, useRef } from "react";
import { css } from "@emotion/react";
import { fromEvent, Subject, takeUntil } from "rxjs";
import { ReactBlockContext } from "../../reactBlock";
import { Changeset } from "blocky-core";

const resizeHandleStyle = css({
  position: "absolute",
  width: "8px",
  height: "48px",
  borderRadius: "5px",
  backgroundColor: "white",
  top: "50%",
  border: "1px solid rgb(221, 221, 221)",
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.1)",
  transform: "translateY(-50%)",
});

interface ResizeHandleProps {
  isLeft?: boolean;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
  onMouseUp?: React.MouseEventHandler<HTMLDivElement>;
}

function ResizeHandle(props: ResizeHandleProps) {
  let style: React.CSSProperties;
  if (props.isLeft) {
    style = {
      left: "8px",
      right: undefined,
      cursor: "w-resize",
    };
  } else {
    style = {
      left: undefined,
      right: "8px",
      cursor: "e-resize",
    };
  }
  return (
    <div
      css={resizeHandleStyle}
      style={style}
      onMouseDown={props.onMouseDown}
      onMouseUp={props.onMouseUp}
    />
  );
}

const imageContentStyle = css({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  img: {
    maxWidth: "100%",
  },
});

export interface ImageBlockContentProps {
  hover?: boolean;
  active?: boolean;
  src: string;
  minWidth: number;
}

const ImageBlockContent = memo((props: ImageBlockContentProps) => {
  const { hover, active, src, minWidth } = props;
  const shouldShowHandles = hover || active;
  const dispose$ = useRef<Subject<void>>();

  useEffect(() => {
    const d = new Subject<void>();
    dispose$.current = d;

    return () => {
      d.next();
      d.complete();
    };
  }, []);

  const { editorController, blockId, blockContainer } =
    useContext(ReactBlockContext)!;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const mouseMove$ = fromEvent<MouseEvent>(document, "mousemove");
    const mouseUp$ = fromEvent<MouseEvent>(document, "mouseup");

    const startRect = blockContainer.getBoundingClientRect();
    const startWidth = startRect.width;
    const startClientX = e.clientX;
    let newWidth = startWidth;

    mouseMove$
      .pipe(takeUntil(mouseUp$), takeUntil(dispose$.current!))
      .subscribe((evt) => {
        evt.preventDefault();

        const clientXDiff = evt.clientX - startClientX;
        newWidth = Math.round(startWidth + clientXDiff);
        newWidth = Math.max(newWidth, minWidth);
        if (newWidth === startWidth) {
          blockContainer.style.removeProperty("width");
        } else {
          blockContainer.style.width = `${newWidth}px`;
        }
      });

    mouseUp$.pipe(takeUntil(dispose$.current!)).subscribe(() => {
      const element = editorController.state.getBlockElementById(blockId);
      if (!element) {
        return;
      }

      new Changeset(editorController.state)
        .updateAttributes(element, {
          width: newWidth,
        })
        .apply();
    });
  };

  return (
    <div css={imageContentStyle}>
      {shouldShowHandles && (
        <>
          <ResizeHandle isLeft onMouseDown={handleMouseDown} />
          <ResizeHandle onMouseDown={handleMouseDown} />
        </>
      )}
      <img src={src} alt="" />
    </div>
  );
});

ImageBlockContent.displayName = "ImageBlockContent";

export default ImageBlockContent;
