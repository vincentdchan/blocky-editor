import { type IDisposable } from "blocky-common/es/disposable";
import type { BlockData } from "@pkg/model";
import { type CollapsedCursor } from "@pkg/model/cursor";
import { type Editor } from "@pkg/view/editor";

export interface BlockDidMountEvent {
  element: HTMLElement;
  clsPrefix: string;
}

export interface BlockCreatedEvent {
  model: BlockData;
  // editor: Editor;
}

export interface BlockFocusedEvent {
  selection: Selection;
  node: HTMLDivElement;
  cursor: CollapsedCursor;
}

export interface BlockContentChangedEvent {
  node: HTMLDivElement;
  offset?: number;
}


export interface IBlockDefinition {
  name: string;

  editable?: boolean;

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


  blockDidMount(e: BlockDidMountEvent) {}

  /**
   * Handle the block is focused.
   * 
   * This hook will only be triggered when the focused id is
   * equal to the block'id. The children is out of situation.
   * 
   */
  blockFocused(e: BlockFocusedEvent): void {}

  blockContentChanged(e: BlockContentChangedEvent): void {}

  render(container: HTMLElement) {}

  findTextOffsetInBlock(focusedNode: Node, offsetInNode: number): number {
    return 0;
  }

  dispose(): void {
    this.#editor = undefined;
  }

}
