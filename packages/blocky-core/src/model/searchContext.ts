import { IDisposable, Slot } from "blocky-common/es";
import { elem, removeNode, ContainerWithCoord } from "blocky-common/es/dom";
import { BlockElement, BlockyNode } from "blocky-data";
import { isString, isObject } from "lodash-es";
import { Editor } from "..";

export interface SearchResult {
  blockId: string;
  startIndex: number;
}

class SearchRangeRect extends ContainerWithCoord {
  constructor() {
    super("blocky-search-range");
  }

  setPositionByRect(containerRect: DOMRect, rect: DOMRect) {
    this.container.style.left = rect.x - containerRect.x + "px";
    this.container.style.top = rect.y - containerRect.y + "px";
    this.container.style.width = rect.width + "px";
    this.container.style.height = rect.height + "px";
  }
}

export class SearchContext implements IDisposable {
  readonly contexts: SearchResult[] = [];
  readonly disposing = new Slot();
  content: string | undefined;
  readonly searchRangesContainer: HTMLDivElement;

  #rangeRects: SearchRangeRect[] = [];

  constructor(
    readonly editorContainer: HTMLDivElement,
    readonly editor: Editor
  ) {
    this.searchRangesContainer = elem("div", "blocky-search-ranges");
    editorContainer.insertBefore(
      this.searchRangesContainer,
      editorContainer.firstChild
    );
  }

  hide() {
    this.searchRangesContainer.style.display = "none";
  }

  show() {
    this.searchRangesContainer.style.removeProperty("display");
  }

  search(content: string) {
    this.show();
    this.contexts.length = 0;
    this.content = content;
    this.#iterateNode(this.editor.state.document); // search in each nodes
    this.#drawRects();
  }

  refresh() {
    if (this.content) {
      this.search(this.content);
    }
  }

  #drawRects() {
    const containerRect = this.editorContainer.getBoundingClientRect();

    let index = 0;
    for (const searchResult of this.contexts) {
      index += this.#drawRectBySearchResult(containerRect, searchResult, index);
    }

    // remove the remain ranges
    if (index < this.#rangeRects.length) {
      for (let i = index; i < this.#rangeRects.length; i++) {
        this.#rangeRects[i].dispose();
      }
      this.#rangeRects.length = index;
    }
  }

  /**
   * Return the length of drawn number
   */
  #drawRectBySearchResult(
    containerRect: DOMRect,
    { blockId, startIndex }: SearchResult,
    index: number
  ): number {
    const origin = index;
    const block = this.editor.state.blocks.get(blockId);
    if (!block) {
      return 0;
    }
    const { content } = this;
    if (!content) {
      return 0;
    }
    const startCursorDom = block.getCursorDomByOffset?.(startIndex);
    const endCursorDom = block.getCursorDomByOffset?.(
      startIndex + content.length
    );
    if (!startCursorDom || !endCursorDom) {
      return 0;
    }
    const range = document.createRange();
    range.setStart(startCursorDom.node, startCursorDom.offset);
    range.setEnd(endCursorDom.node, endCursorDom.offset);

    const rects = range.getClientRects();
    if (rects.length === 0) {
      return 0;
    }

    for (const rect of rects) {
      if (!this.#rangeRects[index]) {
        const rangeRect = new SearchRangeRect();
        rangeRect.mount(this.searchRangesContainer);
        this.#rangeRects[index] = rangeRect;
      }

      this.#rangeRects[index].setPositionByRect(containerRect, rect);

      index++;
    }

    return index - origin;
  }

  #iterateNode(node: BlockyNode) {
    if (node instanceof BlockElement) {
      this.#searchBlockElement(node);
    }

    let ptr = node.firstChild;
    while (ptr) {
      this.#iterateNode(ptr);
      ptr = ptr.nextSibling;
    }
  }

  #searchBlockElement(blockElement: BlockElement) {
    const textModel = blockElement.getTextModel("textContent");
    if (!textModel) {
      return;
    }

    let acc = 0;
    let accStr = "";
    const { content } = this;
    if (!content) {
      return;
    }

    const searchContent = () => {
      const index = accStr.indexOf(content);
      if (index >= 0) {
        this.contexts.push({
          blockId: blockElement.id,
          startIndex: index + acc,
        });
      }
    };

    for (const op of textModel.delta.ops) {
      if (isString(op.insert)) {
        accStr += op.insert;
      } else if (isObject(op.insert)) {
        acc++;
        searchContent();
        acc += accStr.length;
        accStr = "";
      }
    }

    searchContent();
  }

  dispose(): void {
    this.disposing.emit();
    removeNode(this.searchRangesContainer);
  }
}
