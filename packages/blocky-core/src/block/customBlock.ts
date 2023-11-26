import { elem } from "blocky-common/es/dom";
import { DataBaseElement, CursorState } from "@pkg/data";
import Delta from "quill-delta-es";
import {
  BlockDidMountEvent,
  zeroWidthChar,
  BlockFocusedEvent,
  BlockContentChangedEvent,
} from "./basic";
import { ContentBlock } from "./contentBlock";

/**
 * Base class for the block with a content container
 * Handle the copy & paste selection.
 *
 * If you want to write a custom block, extend this class
 */

export class CustomBlock extends ContentBlock {
  #selectSpan: HTMLSpanElement | undefined;

  override blockDidMount(e: BlockDidMountEvent): void {
    super.blockDidMount(e);
    const { element, blockDef } = e;
    const contentContainer = elem("div", "blocky-content");
    this.contentContainer = contentContainer;

    if (!blockDef.Editable) {
      contentContainer.contentEditable = "false";
    }

    element.appendChild(contentContainer);
    const nonWidthChar = document.createTextNode(zeroWidthChar);
    this.#selectSpan = elem("span", "blocky-select-span");
    this.#selectSpan.setAttribute("data-id", e.blockElement.id);
    this.#selectSpan.appendChild(nonWidthChar);
    element.append(this.#selectSpan);

    this.initBlockDnd(contentContainer);
  }

  /**
   * Select the text to simulate the selection.
   */
  override blockFocused(e: BlockFocusedEvent): void {
    const { selection } = e;
    const range = document.createRange();
    range.selectNode(this.#selectSpan!);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * If user input something in the select span.
   * Convert it to new block.
   */
  override blockContentChanged(e: BlockContentChangedEvent): void {
    const { changeset } = e;
    if (this.#selectSpan!.textContent !== zeroWidthChar) {
      const newContent = this.#selectSpan!.textContent!;
      this.#selectSpan!.textContent = zeroWidthChar;
      const newElement = this.editor.state.createTextElement(
        new Delta().insert(newContent)
      );
      changeset.forceUpdate = true;
      changeset.insertChildrenAfter(
        this.props!.parent as DataBaseElement,
        [newElement],
        this.props
      );
      changeset.setCursorState(
        CursorState.collapse(newElement.id, newContent.length)
      );
    }
  }

  override findTextOffsetInBlock(): number {
    return 0;
  }
}
