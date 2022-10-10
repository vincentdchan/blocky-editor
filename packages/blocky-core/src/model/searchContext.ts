import { IDisposable, Slot } from "blocky-common/es";
import { elem, removeNode, ContainerWithCoord } from "blocky-common/es/dom";
import { BlockElement, BlockyNode } from "blocky-data";
import { isString, isObject } from "lodash-es";
import { Editor } from "@pkg/view/editor";

export interface SearchResult {
  blockId: string;
  startIndex: number;
}

class SearchRangeRect extends ContainerWithCoord {
  #x = 0;
  #y = 0;
  #width = 0;
  #height = 0;
  #active = false;

  constructor() {
    super("blocky-search-range");
  }

  setIsActive(active: boolean) {
    if (active === this.#active) {
      return;
    }

    if (active) {
      this.container.classList.add("active");
    } else {
      this.container.classList.remove("active");
    }

    this.#active = active;
  }

  setPositionByRect(containerRect: DOMRect, rect: DOMRect) {
    this.#setPosition(
      rect.x - containerRect.x,
      rect.y - containerRect.y,
      rect.width,
      rect.height
    );
  }

  #setPosition(x: number, y: number, width: number, height: number) {
    if (x !== this.#x) {
      this.container.style.left = x + "px";
      this.#x = x;
    }
    if (y !== this.#y) {
      this.container.style.top = y + "px";
      this.#y = y;
    }
    if (width !== this.#width) {
      this.container.style.width = width + "px";
      this.#width = width;
    }
    if (height !== this.#height) {
      this.container.style.height = height + "px";
      this.#height = height;
    }
  }
}

export class SearchContext implements IDisposable {
  readonly contexts: SearchResult[] = [];
  readonly disposing = new Slot();
  content: string | undefined;
  readonly searchRangesContainer: HTMLDivElement;

  #startIndexes: number[] = [];
  #rangeRects: SearchRangeRect[] = [];
  #activeIndex = 0;
  #clearActiveDisposables: IDisposable[] = [];

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
    this.#startIndexes.length = this.contexts.length;
    this.#drawRects();
    this.#indeedSetActiveIndex(this.#activeIndex);
  }

  #clearPrevRects() {
    this.#clearActiveDisposables.forEach((d) => d.dispose());
    this.#clearActiveDisposables.length = 0;
  }

  setActiveIndex(index: number) {
    if (index === this.#activeIndex) {
      return;
    }
    this.#indeedSetActiveIndex(index);
    this.#activeIndex = index;
  }

  #indeedSetActiveIndex(index: number) {
    this.#clearPrevRects();
    const startIndex = this.#startIndexes[index];
    let endIndex: number;
    if (index >= this.#startIndexes.length - 1) {
      endIndex = this.#startIndexes.length;
    } else {
      endIndex = this.#startIndexes[index + 1];
    }

    for (let i = startIndex; i < endIndex; i++) {
      const rangeRect = this.#rangeRects[i];
      rangeRect.setIsActive(true);
      this.#clearActiveDisposables.push({
        dispose: () => rangeRect.setIsActive(false),
      });
    }
  }

  refresh() {
    if (this.content) {
      this.search(this.content);
    }
  }

  #drawRects() {
    const containerRect = this.editorContainer.getBoundingClientRect();

    let index = 0;
    for (let i = 0, len = this.contexts.length; i < len; i++) {
      this.#startIndexes[i] = index;
      const searchResult = this.contexts[i];
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
      let position = 0;
      for (;;) {
        const index = accStr.indexOf(content, position);
        if (index < 0) {
          break;
        }
        this.contexts.push({
          blockId: blockElement.id,
          startIndex: index + acc,
        });
        position = index + content.length;
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
