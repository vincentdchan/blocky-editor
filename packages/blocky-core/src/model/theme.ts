export const blockyDefaultFonts = `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif`;

export interface ParagraphStyle {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
}

export interface ThemeData {
  font?: string;

  /**
   * The style of primary text
   */
  primary?: ParagraphStyle;

  heading1?: ParagraphStyle;

  heading2?: ParagraphStyle;

  heading3?: ParagraphStyle;
}

export const darkTheme: ThemeData = {
  primary: {
    color: "#c3c3bf",
  },
};
