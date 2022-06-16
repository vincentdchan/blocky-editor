import type { AttributesObject } from "@pkg/model/textModel";

export type SpanRenderer = (element: HTMLSpanElement, attribs: AttributesObject) => void;

// 0 for normal item
export class SpanRegistry {

  #renderer: SpanRenderer[] = []

  on(renderer: SpanRenderer) {
    this.#renderer.push(renderer);
  }

  emit(element: HTMLSpanElement, attribs: AttributesObject) {
    for (const renderer of this.#renderer) {
      try {
        renderer(element, attribs);
      } catch (e) {
        console.error(e);
      }
    }
  }

}
