import { type IDisposable } from "blocky-common/es/disposable";
import { type Position } from "blocky-common/es/position";
import { type HTMLConverter } from "@pkg/helper/htmlConverter";
import {
  type BlockyNode,
  BlockElement,
  BlockyElement,
  CursorState,
  Changeset,
} from "blocky-data";
import { type Editor } from "@pkg/view/editor";
import { type EditorController } from "@pkg/view/controller";
import { elem } from "blocky-common/es/dom";
import Delta from "quill-delta-es";

export interface BlockDidMountEvent {
  element: HTMLElement;
  blockDef: IBlockDefinition;
  blockElement: BlockElement;
  clsPrefix: string;
}

export interface BlockCreatedEvent {
  blockElement: BlockElement;
}

export interface CursorDomResult {
  node: Node;
  offset: number;
}

export interface BlockPasteEventProps {
  editorController: EditorController;
  node: HTMLElement;
  converter: HTMLConverter;
}

export class BlockEvent {
  #defaultPrevented = false;

  preventDefault(): void {
    this.#defaultPrevented = true;
  }

  get defaultPrevented() {
    return this.#defaultPrevented;
  }
}

export class BlockPasteEvent extends BlockEvent {
  editorController: EditorController;
  node: HTMLElement;
  converter: HTMLConverter;

  constructor({ editorController, node, converter }: BlockPasteEventProps) {
    super();
    this.editorController = editorController;
    this.node = node;
    this.converter = converter;
  }
}

export interface TryParsePastedDOMEventProps {
  editorController: EditorController;
  node: HTMLElement;
}

export class TryParsePastedDOMEvent extends BlockEvent {
  editorController: EditorController;
  node: HTMLElement;

  constructor({ editorController, node }: TryParsePastedDOMEventProps) {
    super();
    this.editorController = editorController;
    this.node = node;
  }
}

export interface BlockFocusedEvent {
  selection: Selection;
  node: HTMLDivElement;
  cursor: CursorState;
}

export interface BlockBlurEvent {
  selection: Selection;
  node: HTMLDivElement;
  cursor: CursorState | null;
}

export interface BlockContentChangedEvent {
  changeset: Changeset;
  node: HTMLDivElement;
  blockElement: BlockElement;
  offset?: number;
}

/**
 * This class is used to define a block.
 * Tell the editor the name of the block.
 * Handle the paste event.
 */
export interface IBlockDefinition {
  name: string;

  editable?: boolean;

  /**
   * This method is used to handle pasting specific
   * block copy from the blocky editor.
   *
   * If you want to handle the HTML pasted from another
   * source, please implement [[tryParsePastedDOM]].
   */
  onPaste?(e: BlockPasteEvent): BlockElement | undefined;

  /**
   *
   * If this method is implemented, all the nodes
   * pasted from from the clipboard.
   *
   * The plugin should tell the editor if this dom
   * is handled. If it's handled, the editor will not
   * handle it anymore.
   *
   * Call [[preventDefault()]] if the plugin has handled
   * the node.
   *
   * Otherwise, the editor will pass it to other plugins,
   * or handle it with default handler if no plugins handles.
   *
   */
  tryParsePastedDOM?(e: TryParsePastedDOMEvent): BlockElement | void;

  onBlockCreated(e: BlockCreatedEvent): Block;
}

/**
 * Base class for all the blocks in the editor.
 *
 * If you want to write your own block, extending this class
 * is overkill. Use [ContentBlock].
 */
export class Block implements IDisposable {
  #editor: Editor | undefined;

  get childrenContainerDOM(): HTMLElement | null {
    return null;
  }

  get childrenBeginDOM(): HTMLElement | null {
    return null;
  }

  constructor(public props: BlockElement) {}

  get elementData(): BlockyElement {
    return this.props;
  }

  setEditor(editor: Editor) {
    this.#editor = editor;
  }

  get editor(): Editor {
    return this.#editor!;
  }

  /**
   * Return the offset of the coordinate of the banner
   * relative to the top-right conner of the block.
   */
  getBannerOffset(): Position {
    return { x: 0, y: 0 };
  }

  blockDidMount?(e: BlockDidMountEvent): void;

  onDedent?(e: KeyboardEvent): void;

  onIndent?(e: KeyboardEvent): void;

  /**
   * Handle the block is focused.
   *
   * This hook will only be triggered when the focused id is
   * equal to the block'id. The children is out of situation.
   *
   */
  blockFocused?(e: BlockFocusedEvent): void;

  blockBlur?(e: BlockBlurEvent): void;

  blockContentChanged?(e: BlockContentChangedEvent): void;

  render?(container: HTMLElement): void;

  /**
   * If the block wants the renderer to render children of
   * current block, return the head of the children
   */
  renderChildren?(): BlockyNode | void | null;

  getCursorDomByOffset?(offset: number): CursorDomResult | undefined;

  getCursorHeight(): number {
    return 18;
  }

  findTextOffsetInBlock?(focusedNode: Node, offsetInNode: number): number;

  dispose(): void {
    this.#editor = undefined;
  }
}

const zeroWidthChar = "\u200b";

/**
 * Base class for the block with a content container
 * Handle the copy & paste selection.
 *
 * If you want to write a custom block, extend this class
 */
export class ContentBlock extends Block {
  #contentContainer: HTMLElement | undefined;
  #selectSpan: HTMLSpanElement | undefined;

  /**
   * You elements should be rendered under the contentContainer
   */
  get contentContainer() {
    return this.#contentContainer!;
  }

  override blockDidMount(e: BlockDidMountEvent): void {
    const { element, blockDef } = e;
    const contentContainer = elem("div", "blocky-content");
    this.#contentContainer = contentContainer;

    if (!blockDef.editable) {
      contentContainer.contentEditable = "false";
    }

    element.appendChild(contentContainer);
    const nonWidthChar = document.createTextNode(zeroWidthChar);
    this.#selectSpan = elem("span", "blocky-select-span");
    this.#selectSpan.setAttribute("data-id", e.blockElement.id);
    this.#selectSpan.appendChild(nonWidthChar);
    element.append(this.#selectSpan);
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
        this.props!.parent as BlockyElement,
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
