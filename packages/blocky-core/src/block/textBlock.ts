import { elem } from "blocky-common/es/dom";
import {
  type IBlockDefinition,
  type BlockCreatedEvent,
  type BlockDidMountEvent,
  type BlockFocusedEvent,
  type BlockContentChangedEvent,
  Block,
} from "./basic";
import { type EditorController } from "@pkg/view/controller";
import { type BlockData } from "@pkg/model";
import { TextModel, TextNode } from "@pkg/model/textModel";
import * as fastDiff from "fast-diff";

export const TextBlockName = "text";

const TextContentClass = "blocky-block-text-content";

interface TextPosition {
  node: Node;
  offset: number;
}

class TextBlock extends Block {
  #container: HTMLElement | undefined;

  constructor(private def: TextBlockDefinition, private data: BlockData) {
    super();
  }

  override findTextOffsetInBlock(focusedNode: Node, offsetInNode: number): number {
    const blockContainer = this.#container!;
    const contentContainer = this.findContentContainer!(blockContainer as HTMLElement);
    let counter = 0;
    let ptr = contentContainer.firstChild;

    const parentOfFocused = focusedNode.parentNode!;
    if (parentOfFocused instanceof HTMLSpanElement) {
      focusedNode = parentOfFocused;
    }

    while (ptr) {
      if (ptr === focusedNode) {
        break;
      }
      counter += ptr.textContent?.length ?? 0;
      ptr = ptr.nextSibling;
    }

    return counter + offsetInNode;
  }

  protected findContentContainer(parent: HTMLElement) {
    return parent.firstChild! as HTMLElement;
  }

  override blockDidMount({ element }: BlockDidMountEvent): void {
    const content = elem("div", TextContentClass);

    const block = this.data.data as TextModel;
    const level = block.level;
    if (level === 1) {
      element.classList.add("blocky-heading1");
    } else if (level === 2) {
      element.classList.add("blocky-heading2");
    } else if (level === 3) {
      element.classList.add("blocky-heading3");
    }

    element.appendChild(content);
  }

  override blockFocused({ node: blockDom, selection, cursor }: BlockFocusedEvent): void {
    const contentContainer = this.findContentContainer(blockDom);

    const { offset } = cursor;
    const pos = this.findFocusPosition(blockDom, offset);
    if (!pos) {
      const { firstChild } = contentContainer;

      if (firstChild == null) {
        setRangeIfDifferent(selection, contentContainer, 0, contentContainer, 0);
        return;
      }

      setRangeIfDifferent(selection, firstChild, 0, firstChild, 0);
    } else {
      const { node, offset } = pos;
      setRangeIfDifferent(selection, node, offset, node, offset);
    }
  }

  private findFocusPosition(
    blockDom: HTMLElement,
    absoluteOffset: number
  ): TextPosition | undefined {
    const contentContainer = this.findContentContainer(blockDom);
    let ptr = contentContainer.firstChild;

    while (ptr) {
      const contentLength = ptr.textContent?.length ?? 0;
      if (absoluteOffset <= contentLength) {
        let node = ptr;
        if (node instanceof HTMLSpanElement && node.firstChild) {
          node = node.firstChild
        }
        return { node, offset: absoluteOffset };
      } else {
        absoluteOffset -= contentLength;
      }

      ptr = ptr.nextSibling;
    }

    return;
  }

  override blockContentChanged({ node, offset }: BlockContentChangedEvent): void {
    const contentContainer = this.findContentContainer(node);
    let textContent = "";

    const blockData = this.data;
    let ptr = contentContainer.firstChild;
    while (ptr) {
      textContent += ptr.textContent;
      ptr = ptr.nextSibling;
    }

    const textModel = blockData.data as TextModel;
    const oldContent = textModel.toString();

    const diffs = fastDiff(oldContent, textContent, offset);

    let index = 0;
    for (const [t, content] of diffs) {
      if (t === fastDiff.EQUAL) {
        index += content.length;
      } else if (t === fastDiff.INSERT) {
        textModel.insert(index, content);
        index += content.length;
      } else if (t === fastDiff.DELETE) {
        textModel.delete(index, content.length);
        index -= content.length;
      }
    }
    console.log("content:", textModel.toString(), textModel.nodeBegin);
  }

  override render(container: HTMLElement, editorController: EditorController) {
    this.#container = container;
    const { id } = this.data;
    const blockNode = editorController.state.idMap.get(id)!;
    const block = blockNode.data as BlockData<TextModel>;
    const textModel = block.data;
    if (!textModel) {
      return;
    }

    const contentContainer = this.findContentContainer(container);
    this.renderBlockTextContent(contentContainer, textModel, editorController);
  }

  private renderBlockTextContent(contentContainer: HTMLElement, textModel: TextModel, editorController: EditorController) {
    let nodePtr = textModel.nodeBegin;
    let domPtr: Node | null = contentContainer.firstChild;
    let prevDom: Node | null = null;

    while (nodePtr) {
      if (!domPtr) {
        domPtr = createDomByNode(nodePtr, editorController);
        contentContainer.insertBefore(domPtr, prevDom?.nextSibling ?? null);
      } else {  // is old
        if (!isNodeMatch(nodePtr, domPtr)) {
          const oldDom = domPtr;
          const newNode = createDomByNode(nodePtr, editorController);

          nodePtr = nodePtr.next;
          prevDom = domPtr;
          domPtr = domPtr.nextSibling;

          contentContainer.replaceChild(newNode, oldDom);
          continue;
        } else if (domPtr.textContent !== nodePtr.content) {
          domPtr.textContent = nodePtr.content;
        }
      }

      nodePtr = nodePtr.next;
      prevDom = domPtr;
      domPtr = domPtr.nextSibling;
    }

    // remove remaining text
    while (domPtr) {
      const next = domPtr.nextSibling;
      domPtr.parentNode?.removeChild(domPtr);

      domPtr = next;
    }
  }

}

function createDomByNode(node: TextNode, editorController: EditorController): Node {
  if (node.attributes) {
    const d = elem("span");
    d.textContent = node.content;

    if (node.attributes) {
      editorController.spanRegistry.emit(d, node.attributes);
    }

    return d;
  } else {
    return document.createTextNode(node.content);
  }
}

function isNodeMatch(node: TextNode, dom: Node): boolean {
  if (node.attributes && dom instanceof HTMLSpanElement) {
    return true;
  }

  if (!node.attributes && node instanceof Text) {
    return true;
  }

  return false;
}

class TextBlockDefinition implements IBlockDefinition {
  public name: string = TextBlockName;
  public editable: boolean = true;

  onBlockCreated({ model: data }: BlockCreatedEvent): Block {
    return new TextBlock(this, data);
  }

}

function setRangeIfDifferent (
  sel: Selection,
  startContainer: Node,
  startOffset: number,
  endContainer: Node,
  endOffset: number
) {
  if (isRangeEqual(sel, startContainer, startOffset, endContainer, endOffset)) {
    return;
  }
  sel.removeAllRanges();
  const range = document.createRange();
  range.setStart(startContainer, startOffset);
  range.setEnd(endContainer, endOffset);
  sel.addRange(range);
}

function isRangeEqual(
  sel: Selection,
  startContainer: Node,
  startOffset: number,
  endContainer: Node,
  endOffset: number
): boolean {
  if (sel.rangeCount === 0) {
    return false;
  }
  const range = sel.getRangeAt(0);

  return (
    range.startContainer === startContainer &&
    range.startOffset === startOffset &&
    range.endContainer === endContainer &&
    range.endOffset === endOffset
  );
}

export function makeTextBlockDefinition(): IBlockDefinition {
  return new TextBlockDefinition();
}
