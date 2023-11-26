import { css } from "@emotion/react";

const maskStyle = css({
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
});

export interface MaskProps {
  children?: any;
  onClick?: () => void;
}

function Mask(props: MaskProps) {
  const { children, onClick } = props;
  return (
    <div css={maskStyle} onClick={onClick}>
      {children}
    </div>
  );
}

export default Mask;
