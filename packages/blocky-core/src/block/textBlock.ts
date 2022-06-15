import { elem } from "blocky-common/es/dom";
import {
  type IBlockDefinition,
  BlockContentType,
  type BlockCreatedEvent,
  BlockFocusedEvent,
} from "./basic";
import { type EditorController } from "@pkg/view/controller";
import { Block } from "@pkg/model";
import { TextModel } from "@pkg/model/textModel";

export const TextBlockName = "text";

const TextContentClass = "blocky-block-text-content";

interface TextPosition {
  node: Node;
  offset: number;
}

class TextBlockDefinition implements IBlockDefinition {
  public name: string = TextBlockName;
  public type: BlockContentType = BlockContentType.Text;

  findContentContainer(parent: HTMLElement) {
    return parent.firstChild! as HTMLElement;
  }

  onContainerCreated({ element, block }: BlockCreatedEvent) {
    const content = elem("div", TextContentClass);

    const level = block.data?.level ?? 0;
    if (level === 1) {
      element.classList.add("blocky-heading1");
    } else if (level === 2) {
      element.classList.add("blocky-heading2");
    } else if (level === 3) {
      element.classList.add("blocky-heading3");
    }

    element.appendChild(content);
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
        return { node: ptr, offset: absoluteOffset };
      } else {
        absoluteOffset -= contentLength;
      }

      ptr = ptr.nextSibling;
    }

    return;
  }

  onBlockFocused({ node: blockDom, selection, cursor }: BlockFocusedEvent) {
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

  render(container: HTMLElement, editorController: EditorController, id: string): void {
    const blockNode = editorController.state.idMap.get(id)!;
    const block = blockNode.data as Block<TextModel>;
    const textModel = block.data;
    if (!textModel) {
      return;
    }

    const contentContainer = this.findContentContainer(container);
    this.renderBlockTextContent(contentContainer, textModel);
  }

  private renderBlockTextContent(contentContainer: HTMLElement, textModel: TextModel) {
    let nodePtr = textModel.nodeBegin;
    let domPtr = contentContainer.firstChild;
    let prevDom: Node | null = null;

    while (nodePtr) {
      if (!domPtr) {
        domPtr = document.createTextNode(nodePtr.content);
        contentContainer.insertBefore(domPtr, prevDom);
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
