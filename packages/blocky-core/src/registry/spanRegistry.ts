import { Registry } from "./registry";
import type { AttributesObject } from "blocky-data";
import { isString } from "lodash-es";

export type SpanRenderer = (
  element: HTMLSpanElement,
  attribs: AttributesObject
) => void;

/**
 * Span is an element including editable text.
 * It has it's own styles such as bold/italic/underline.
 *
 * The styles of the span can be mixed. A range of text
 * can have multiple styles.
 */
export interface SpanStyle {
  name: string;
  className?: string;
  onSpanCreated?: (elem: HTMLElement) => void;
}

// 0 for normal item
export class SpanRegistry extends Registry<SpanStyle> {
  readonly styles: Map<string, SpanStyle> = new Map();
  readonly classnames: Map<string, SpanStyle> = new Map();

  register(style: SpanStyle) {
    this.ensureUnsealed();
    this.styles.set(style.name, style);
    if (isString(style.className)) {
      this.classnames.set(style.className, style);
    }
  }
}
