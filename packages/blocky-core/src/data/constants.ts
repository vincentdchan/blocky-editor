export enum TextType {
  Quote = "quote",
  Checkbox = "checkbox",
  Bulleted = "bulleted",
  Numbered = "numbered",
  Normal = "normal",
  Heading1 = "h1",
  Heading2 = "h2",
  Heading3 = "h3",
}

export function textTypePrecedence(textType: TextType): number {
  switch (textType) {
    case TextType.Quote:
      return -4;

    case TextType.Numbered:
      return -3;

    case TextType.Checkbox:
      return -2;

    case TextType.Bulleted:
      return -1;

    case TextType.Heading1:
      return 1;

    case TextType.Heading2:
      return 2;

    case TextType.Heading3:
      return 3;

    default:
      return 0;
  }
}
