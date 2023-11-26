import { type IDisposable, type Position } from "blocky-common/es";
import { type HTMLConverter } from "@pkg/helper/htmlConverter";
import {
  type DataBaseNode,
  BlockDataElement,
  DataBaseElement,
  CursorState,
  Changeset,
} from "@pkg/data";
import { Subject } from "rxjs";
import { type Editor } from "@pkg/view/editor";
import { type EditorController } from "@pkg/view/controller";
import { RenderOption } from "@pkg/view/renderer";

export interface BlockDidMountEvent {
  element: HTMLElement;
  blockDef: IBlockDefinition;
  blockElement: BlockDataElement;
  clsPrefix: string;
}

export interface BlockCreatedEvent {
  blockElement: BlockDataElement;
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
  blockElement: BlockDataElement;
  offset?: number;
}

/**
 * This class is used to define a block.
 * Tell the editor the name of the block.
 * Handle the paste event.
 */
export interface IBlockDefinition {
  Name: string;

  Editable?: boolean;

  /**
   * This method is used to handle pasting specific
   * block copy from the blocky editor.
   *
   * If you want to handle the HTML pasted from another
   * source, please implement [[tryParsePastedDOM]].
   */
  OnPaste?(e: BlockPasteEvent): BlockDataElement | undefined;

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
  TryParsePastedDOM?(e: TryParsePastedDOMEvent): BlockDataElement | void;

  new (e: BlockCreatedEvent): Block;
}

export enum BlockDragOverState {
  None = 0,
  Top = 1,
  Bottom = 2,
}

/**
 * Base class for all the blocks in the editor.
 *
 * If you want to write your own block, extending this class
 * is overkill. Use [ContentBlock].
 */
export class Block implements IDisposable {
  #editor: Editor | undefined;
  readonly dispose$ = new Subject<void>();

  get childrenContainerDOM(): HTMLElement | null {
    return null;
  }

  get childrenBeginDOM(): HTMLElement | null {
    return null;
  }

  props: BlockDataElement;

  constructor(evt: BlockCreatedEvent) {
    this.props = evt.blockElement;
  }

  get elementData(): DataBaseElement {
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
  getSpannerOffset(): Position {
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

  render?(container: HTMLElement, option: RenderOption): void;

  /**
   * If the block wants the renderer to render children of
   * current block, return the head of the children
   */
  renderChildren?(): DataBaseNode | void | null;

  getCursorDomByOffset?(offset: number): CursorDomResult | undefined;

  getCursorHeight(): number {
    return 18;
  }

  findTextOffsetInBlock?(focusedNode: Node, offsetInNode: number): number;

  dispose(): void {
    this.dispose$.next();
    this.#editor = undefined;
  }
}

export const zeroWidthChar = "\u200b";
