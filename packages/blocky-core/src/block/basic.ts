import { type IDisposable } from "blocky-common/es/disposable";
import { type Position } from "blocky-common/es/position";
import { type HTMLConverter } from "@pkg/helper/htmlConverter";
import { CursorState, type CollapsedCursor } from "@pkg/model/cursor";
import { BlockyElement, symSetAttribute } from "@pkg/model/tree";
import { BlockyNode } from "@pkg/model/element";
import { type Editor } from "@pkg/view/editor";
import { type EditorController } from "@pkg/view/controller";
import { DocNodeName } from "@pkg/model/state";
import { Changeset } from "@pkg/model/change";
import type { AttributesObject } from "..";
import { isUndefined } from "lodash-es";

export interface BlockDidMountEvent {
  element: HTMLElement;
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
  cursor: CollapsedCursor;
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
 * This is a data layer of a block.
 * ID is used to locate a block in the document tree.
 *
 * A BlockElement can contain a <children-container>
 * at the end of the block to store the children.
 */
export class BlockElement extends BlockyElement {
  constructor(
    blockName: string,
    id: string,
    attributes?: AttributesObject,
    children?: BlockyNode[]
  ) {
    if (isUndefined(attributes)) {
      attributes = {};
    }
    attributes.id = id;
    super(blockName, attributes, children);
  }

  get childrenContainer(): BlockyElement | undefined {
    const { lastChild } = this;
    if (!lastChild) {
      return;
    }

    if (lastChild.nodeName === "block-children") {
      return lastChild as BlockyElement;
    }

    return;
  }

  override [symSetAttribute](name: string, value: string) {
    if (name === "block-children") {
      throw new TypeError(`${name} is reserved`);
    }
    super[symSetAttribute](name, value);
  }

  get id(): string {
    return this.getAttribute("id")!;
  }

  /**
   * Return the level of block,
   * not the level of [Node].
   */
  blockLevel(): number {
    const parentNode = this.parent;
    if (!parentNode) {
      return Number.MAX_SAFE_INTEGER;
    }

    if (parentNode.nodeName === DocNodeName) {
      return 0;
    }

    if (parentNode.nodeName === "block-children") {
      const parentOfParent = parentNode.parent;
      if (!parentOfParent || !(parentOfParent instanceof BlockElement)) {
        return Number.MAX_SAFE_INTEGER;
      }
      return parentOfParent.blockLevel() + 1;
    }

    return Number.MAX_SAFE_INTEGER;
  }

  override clone(): BlockElement {
    const attribs = this.getAttributes();
    delete attribs.id;

    let childPtr = this.firstChild;

    const children: BlockyNode[] = [];
    while (childPtr) {
      children.push(childPtr.clone());
      childPtr = childPtr.nextSibling;
    }

    return new BlockElement(this.nodeName, this.id, attribs, children);
  }
}

/**
 * Base class for all the blocks in the editor.
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

  getCursorDomByOffset?(offset: number): CursorDomResult | undefined;

  getCursorHeight(): number {
    return 18;
  }

  findTextOffsetInBlock?(focusedNode: Node, offsetInNode: number): number;

  dispose(): void {
    this.#editor = undefined;
  }
}
