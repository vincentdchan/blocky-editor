import React, { useEffect, useState } from "react";
import { css } from "@emotion/react";

export interface MenuProps {
  style?: React.CSSProperties;
  children?: any;
}

const menuStyle = css({
  fontFamily: "var(--blocky-font)",
  backgroundColor: "var(--bg-color)",
  boxShadow: "0px 0px 4px rgba(0, 0, 0, 0.2)",
  borderRadius: "8px",
  overflow: "hidden",
  transitionProperty: "opacity, transform",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease",
});

export function Menu(props: MenuProps) {
  const { children, style } = props;
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    setOpacity(1);
  }, []);
  return (
    <div
      css={menuStyle}
      style={{
        opacity,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export interface MenuItemProps {
  style?: React.CSSProperties;
  onClick?: () => void;
  children?: any;
}

const menuItemStyle = css({
  width: "240px",
  padding: "8px 12px",
  fontSize: "14px",
  color: "rgb(72, 72, 72)",
  "&:hover": {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
});

export function MenuItem(props: MenuItemProps) {
  const { style, onClick, children } = props;
  return (
    <div
      css={menuItemStyle}
      className="blocky-cm-noselect"
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}

const dividerStyle = css({
  marginTop: "4px",
  marginBottom: "4px",
  width: "100%",
  height: "1px",
  backgroundColor: "rgb(236, 236, 236)",
});

export function Divider() {
  return <div css={dividerStyle} className="blocky-menu-divider"></div>;
}
