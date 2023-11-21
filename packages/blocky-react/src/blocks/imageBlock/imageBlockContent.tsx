import { memo } from "react";
import { css } from "@emotion/react";

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
}

const ImageBlockContent = memo((props: ImageBlockContentProps) => {
  const { hover, active, src } = props;
  const shouldShowHandles = hover || active;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
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
