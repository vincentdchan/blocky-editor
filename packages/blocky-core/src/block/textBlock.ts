import { elem } from "blocky-common/es/dom";
import { type IBlockDefinition, BlockContentType, type BlockCreatedEvent, BlockFocusedEvent } from "./basic";

export const TextBlockName = "text";

const TextContentClass = 'blocky-block-text-content';

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

  onBlockFocused({ node: blockDom, selection }: BlockFocusedEvent) {
    const contentContainer = blockDom.querySelector(`.${TextContentClass}`);
    if (!contentContainer) {
      return;
    }

    selection.removeAllRanges();

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
  }

}

export function makeTextBlockDefinition(): IBlockDefinition {
  return new TextBlockDefinition();
}
