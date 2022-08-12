export interface ParagraphStyle {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
}

export interface ThemeData {
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
