import { type IDisposable } from "blocky-common/es/disposable";
import type { BlockData } from "@pkg/model";
import { CursorState, type CollapsedCursor } from "@pkg/model/cursor";
import { type Editor } from "@pkg/view/editor";
import { type Position } from "blocky-common/src/position";

export interface BlockDidMountEvent {
  element: HTMLElement;
  clsPrefix: string;
}

export interface BlockCreatedEvent {
  model: BlockData;
  // editor: Editor;
}

export interface CursorDomResult {
  node: Node;
  offset: number;
}

export interface BlockPasteEventProps {
  after: CursorState | undefined;
  editor: Editor;
  node: HTMLElement;
  tryMerge: boolean;
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
  after: CursorState | undefined;
  editor: Editor;
  node: HTMLElement;
  tryMerge: boolean;

  constructor({ after, editor, node, tryMerge }: BlockPasteEventProps) {
    super();
    this.after = after;
    this.editor = editor;
    this.node = node;
    this.tryMerge = tryMerge;
  }

}

export interface TryParsePastedDOMEventProps {
  after: CursorState | undefined;
  editor: Editor;
  node: HTMLElement;
}

export class TryParsePastedDOMEvent extends BlockEvent {
  after: CursorState | undefined;
  editor: Editor;
  node: HTMLElement;

  constructor({ after, editor, node }: TryParsePastedDOMEventProps) {
    super();
    this.after = after;
    this.editor = editor;
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
  cursor: CursorState | undefined;
}

export interface BlockContentChangedEvent {
  node: HTMLDivElement;
  offset?: number;
}

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
  onPaste?(e: BlockPasteEvent): CursorState | undefined;

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
  tryParsePastedDOM?(e: TryParsePastedDOMEvent): void;

  onBlockCreated(e: BlockCreatedEvent): Block;

}

export class Block<T = any> implements IDisposable {
  #editor: Editor | undefined;

  constructor(public props: BlockData<T>) {}

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

  blockDidMount(e: BlockDidMountEvent) {}

  /**
   * Handle the block is focused.
   * 
   * This hook will only be triggered when the focused id is
   * equal to the block'id. The children is out of situation.
   * 
   */
  blockFocused(e: BlockFocusedEvent): void {}

  blockBlur(e: BlockBlurEvent): void {}

  blockContentChanged(e: BlockContentChangedEvent): void {}

  render(container: HTMLElement) {}

  getCursorDomByOffset(offset: number): CursorDomResult | undefined {
    return;
  }

  findTextOffsetInBlock(focusedNode: Node, offsetInNode: number): number {
    return 0;
  }

  dispose(): void {
    this.#editor = undefined;
  }

}
