import { isObject } from "lodash-es";
import { BlockElement } from "@pkg/index";
import { TextBlockName } from "@pkg/block/textBlock";
import { BlockyTextModel } from "@pkg/model/tree";
import type { IdGenerator } from "@pkg/helper/idHelper";

function createTextElement(id: string, content: string): BlockElement {
  const textModel = new BlockyTextModel();
  textModel.insert(0, content);
  const result = new BlockElement(TextBlockName, id);
  result.appendChild(result);
  return result;
}

function isLeafElement(node: Node): node is HTMLElement {
  return (
    node instanceof HTMLParagraphElement ||
    node instanceof HTMLHeadingElement ||
    node instanceof HTMLLIElement
  );
}

function isContainerElement(node: Node): node is HTMLElement {
  return node instanceof HTMLUListElement || node instanceof HTMLDivElement;
}

export type ElementHandler = (node: Node) => BlockElement | undefined | boolean;

export interface HTMLConverterOptions {
  idGenerator: IdGenerator;
  leafHandler?: ElementHandler;
  divHandler?: ElementHandler;
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

  parseFromString(content: string): BlockElement[] {
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(content, "text/html");
    return this.parseBody(doc.body);
  }

  parseBody(doc: HTMLElement): BlockElement[] {
    const result: BlockElement[] = [];

    let ptr = doc.firstChild;
    while (ptr) {
      this.tryParseNode(ptr, result);
      ptr = ptr.nextSibling;
    }

    return result;
  }

  private tryParseNode(node: Node, result: BlockElement[]) {
    if (node instanceof Text) {
      const { textContent } = node;
      if (textContent) {
        result.push(
          createTextElement(this.#idGenerator.mkBlockId(), textContent)
        );
      }
    } else if (isLeafElement(node)) {
      const blockElement = this.#leafHandler?.(node);
      if (isObject(blockElement)) {
        result.push(blockElement);
        return;
      }
      if (blockElement === true) {
        return;
      }
      const { textContent } = node;
      if (textContent) {
        result.push(
          createTextElement(this.#idGenerator.mkBlockId(), textContent)
        );
      }
    } else if (isContainerElement(node)) {
      if (node instanceof HTMLDivElement) {
        const blockElement = this.#divHandler?.(node);
        if (isObject(blockElement)) {
          result.push(blockElement);
        }
        if (blockElement === true) {
          return;
        }
      }
      return this.tryParseContainerElement(node, result);
    }
  }

  private tryParseContainerElement(
    container: HTMLElement,
    result: BlockElement[]
  ): BlockElement | void {
    let ptr = container.firstChild;

    while (ptr) {
      this.tryParseNode(ptr, result);
      ptr = ptr.nextSibling;
    }
  }
}
