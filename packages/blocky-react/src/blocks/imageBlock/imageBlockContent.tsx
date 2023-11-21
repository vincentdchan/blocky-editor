import { css } from "@emotion/react";

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
  src: string;
}

function ImageBlockContent(props: ImageBlockContentProps) {
  return (
    <div css={imageContentStyle}>
      <img src={props.src} alt="" />
    </div>
  );
}

export default ImageBlockContent;
