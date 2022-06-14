import { elem } from "blocky-common/es/dom";
import { type IBlockDefinition, BlockContentType, type BlockCreatedEvent, BlockFocusedEvent } from "./basic";

export const TextBlockName = "text";

const TextContentClass = 'blocky-block-text-content';

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

  private findFocusPosition(blockDom: HTMLElement, absoluteOffset: number): TextPosition | undefined {
    const contentContainer = this.findContentContainer(blockDom);
    let ptr = contentContainer.firstChild;

    while (ptr) {
      const contentLength = ptr.textContent?.length ?? 0;
      if (absoluteOffset < contentLength) {
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

    if (cursor.type === "collapsed") {
      const { offset } = cursor;
      const pos = this.findFocusPosition(blockDom, offset);
      selection.removeAllRanges();
      if (!pos) {

        const { firstChild } = contentContainer;

        if (firstChild == null) {
          const range = document.createRange();
          range.setStart(contentContainer, 0);
          range.setEnd(contentContainer, 0);
          selection.addRange(range);
          return;
        }

        const range = document.createRange();
        range.setStart(firstChild, 0);
        range.setEnd(firstChild, 0);
        selection.addRange(range);
      } else {
        const { node, offset } = pos;
        const range = document.createRange();
        range.setStart(node, offset);
        range.setEnd(node, offset);
        selection.addRange(range);
      }
    }
  }
}

export function makeTextBlockDefinition(): IBlockDefinition {
  return new TextBlockDefinition();
}
