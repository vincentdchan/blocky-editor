import { isObject } from "lodash-es";
import { BlockElement, BlockyTextModel } from "blocky-data";
import { TextBlock } from "@pkg/block/textBlock";
import { removeLineBreaks } from "blocky-common/es/text";
import { textToDeltaWithURL } from "@pkg/helper/urlHelper";
import type { IdGenerator } from "@pkg/helper/idHelper";

function createTextElement(id: string, content: string): BlockElement {
  content = removeLineBreaks(content);
  const textModel = new BlockyTextModel(textToDeltaWithURL(content));
  return new BlockElement(TextBlock.Name, id, {
    textContent: textModel,
  });
}

function isLeafElement(node: Node): node is HTMLElement {
  return (
    node instanceof HTMLParagraphElement ||
    node instanceof HTMLHeadingElement ||
    node instanceof HTMLLIElement ||
    node instanceof HTMLSpanElement
  );
}

export type ElementHandler = (node: Node) => BlockElement | void | boolean;

export interface HTMLConverterOptions {
  idGenerator: IdGenerator;
  leafHandler?: ElementHandler;
  divHandler?: ElementHandler;
}

function shouldBeGivenUp(contentString: string): boolean {
  return /^\s*$/.test(contentString);
}

/**
 * This class is used to parse
 * the HTML pasted by the user.
 *
 * Convert the HTML to BlockElements
 */
export class HTMLConverter {
  #idGenerator: IdGenerator;
  #leafHandler: ElementHandler | undefined;
  #divHandler: ElementHandler | undefined;
  constructor({ idGenerator, leafHandler, divHandler }: HTMLConverterOptions) {
    this.#idGenerator = idGenerator;
    this.#leafHandler = leafHandler;
    this.#divHandler = divHandler;
  }

  isContainerElement(node: Node): boolean {
    return node instanceof HTMLUListElement || node instanceof HTMLDivElement;
  }

  parseFromString(content: string): BlockElement[] {
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(content, "text/html");
    return this.parseBody(doc.body);
  }

  parseBody(doc: HTMLElement): BlockElement[] {
    const result: BlockElement[] = [];

    let ptr = doc.firstChild;
    while (ptr) {
      this.#tryParseNode(ptr, result);
      ptr = ptr.nextSibling;
    }

    return result;
  }

  #pushTextIfPossible(node: Node, result: BlockElement[]) {
    const { textContent } = node;
    if (textContent) {
      const lines = textContent.split("\n");
      for (const line of lines) {
        if (shouldBeGivenUp(line)) {
          continue;
        }
        result.push(createTextElement(this.#idGenerator.mkBlockId(), line));
      }
    }
  }

  #tryParseNode(node: Node, result: BlockElement[]) {
    if (node instanceof Text) {
      this.#pushTextIfPossible(node, result);
    } else if (isLeafElement(node)) {
      const blockElement = this.#leafHandler?.(node);
      if (isObject(blockElement)) {
        result.push(blockElement);
        return;
      }
      if (blockElement === true) {
        return;
      }
      this.#pushTextIfPossible(node, result);
    } else if (this.isContainerElement(node)) {
      if (node instanceof HTMLDivElement) {
        const blockElement = this.#divHandler?.(node);
        if (isObject(blockElement)) {
          result.push(blockElement);
          return;
        }
        if (blockElement === true) {
          return;
        }
      }
      const tmp = this.parseContainerElement(node as HTMLElement);
      result.push(...tmp);
    }
  }

  parseContainerElement(container: HTMLElement): BlockElement[] {
    const result: BlockElement[] = [];
    let ptr = container.firstChild;
    while (ptr) {
      this.#tryParseNode(ptr, result);
      ptr = ptr.nextSibling;
    }
    return result;
  }
}
