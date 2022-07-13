import { type IDisposable } from "blocky-common/es/disposable";
import { type Position } from "blocky-common/es/position";
import { CursorState, type CollapsedCursor } from "@pkg/model/cursor";
import { BlockyElement } from "@pkg/model/tree";
import { type Editor } from "@pkg/view/editor";
import { DocNodeName } from "@pkg/model/state";

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

export class BlockElement extends BlockyElement {

  // public contentContainer: BlockyElement;
  // public childrenContainer: BlockyElement;

  constructor(blockName: string, id: string) {
    super(blockName);
    // this.contentContainer = new BlockyElement("block-content");
    // this.childrenContainer = new BlockyElement("block-children");
    // this.appendChild(this.contentContainer);
    // this.appendChild(this.childrenContainer);

    this.setAttribute("id", id);
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

  override setAttribute(name: string, value: string) {
    if (name === "block-children") {
      throw new TypeError(`${name} is reserved`);
    }
    super.setAttribute(name, value);
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
    const result = new BlockElement(this.nodeName, this.id);

    const attribs = this.getAttributes();
    for (const key in attribs) {
      if (key === "id") {
        continue;
      }
      const value = attribs[key];
      if (value) {
        result.setAttribute(key, value);
      }
    }

    let childPtr = this.firstChild;

    while (childPtr) {
      result.appendChild(childPtr.clone());
      childPtr = childPtr.nextSibling;
    }
    
    return result;
  }

}

export class Block implements IDisposable {
  #editor: Editor | undefined;

  get childrenContainerDOM(): HTMLElement | null {
    return null
  }

  get childrenBeginDOM(): HTMLElement | null {
    return null
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

  blockDidMount(e: BlockDidMountEvent) {}

  onDedent(e: KeyboardEvent) {}

  onIndent(e: KeyboardEvent) {}

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

  getCursorHeight(): number {
    return 18;
  }

  findTextOffsetInBlock(focusedNode: Node, offsetInNode: number): number {
    return 0;
  }

  dispose(): void {
    this.#editor = undefined;
  }

}
