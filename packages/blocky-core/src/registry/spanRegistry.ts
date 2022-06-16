import type { AttributesObject } from "@pkg/model/textModel";

export type SpanRenderer = (element: HTMLSpanElement, attribs: AttributesObject) => void;

export interface SpanStyle {
  name: string;
  className: string;
  onSpanCreated?: (elem: HTMLElement) => void;
}

// 0 for normal item
export class SpanRegistry {

  public readonly styles: Map<string, SpanStyle> = new Map();
  public readonly classnames: Map<string, SpanStyle> = new Map();

  register(style: SpanStyle) {
    this.styles.set(style.name, style);
    this.classnames.set(style.className, style);
  }

}
