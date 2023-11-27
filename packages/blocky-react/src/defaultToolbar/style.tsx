import { css } from "@emotion/react";

export const toolbarContainerStyle = css({
  fontFamily: `var(--blocky-font)`,
  fontWeight: 400,
  backgroundColor: "var(--bg-color)",
  boxShadow: "0px 0px 4px rgba(0, 0, 0, 0.2)",
  padding: 0,
  borderRadius: 4,
  overflow: "hidden",
  boxSizing: "border-box",
  transitionProperty: "opacity, transform",
  transitionDuration: "200ms",
  transitionTimingFunction: "ease",
});

export const toolbarMenuButton = css({
  backgroundColor: "var(--bg-color)",
  color: "var(--primary-text-color)",
  border: "none",
  margin: 0,
  height: 32,
  "&.rect": {
    width: 32,
  },
  "&:hover": {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  "&.bold": {
    // fontFamily: `'Times New Roman', Times, serif`,
    fontWeight: 600,
  },
  "&.italic": {
    // fontFamily: `'Times New Roman', Times, serif`,
    fontStyle: "italic",
  },
  "&.underline": {
    // fontFamily: `'Times New Roman', Times, serif`,
    textDecoration: "underline",
  },
});

export const anchorToolbarStyle = css(toolbarContainerStyle, {
  position: "fixed",
  padding: "4px 8px",
  height: 32,
  input: {
    height: "100%",
    border: "none",
    marginRight: 8,
    "&:focus": {
      outline: "none",
    },
  },
  button: {
    height: "100%",
    fontSize: 12,
    padding: "2px 4px",
  },
});
