import { IDisposable } from "blocky-common/es/disposable";
import { Slot } from "blocky-common/src/slot";
import { BlockElement, BlockyDocument, BlockyNode } from "blocky-data";
import { isString, isObject } from "lodash-es";

export interface SearchResult {
  blockId: string;
  startIndex: number;
}

export class SearchContext implements IDisposable {
  readonly contexts: SearchResult[] = [];
  readonly disposing = new Slot();
  content: string | undefined;

  constructor(readonly document: BlockyDocument) {}

  search(content: string) {
    this.contexts.length = 0;
    this.content = content;
    this.#iterateNode(this.document);
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
  }
}
