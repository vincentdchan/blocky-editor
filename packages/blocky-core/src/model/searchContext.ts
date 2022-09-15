import { BlockElement, BlockyDocument, BlockyNode } from "blocky-data";
import { isString, isObject } from "lodash-es";

export interface SearchResult {
  blockId: string;
  startIndex: number;
}

export class SearchContext {
  readonly contexts: SearchResult[] = [];

  constructor(readonly document: BlockyDocument, readonly content: string) {
    this.#iterateNode(document);
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

    const searchContent = () => {
      const index = accStr.indexOf(this.content);
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
}
