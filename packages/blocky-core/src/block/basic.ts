import { type IDisposable } from "blocky-common/es/disposable";
import type { TreeNode, DocNode, BlockData } from "@pkg/model";
import { type CollapsedCursor } from "@pkg/model/cursor";
import { type EditorController } from "@pkg/view/controller";

export interface BlockCreatedEvent {
  element: HTMLElement;
  clsPrefix: string;
  node: TreeNode<DocNode>;
  block: BlockData,
}

export interface BlockFocusedEvent {
  selection: Selection;
  node: HTMLDivElement;
  cursor: CollapsedCursor;
}

export interface BlockContentChangedEvent {
  node: HTMLDivElement;
  block: BlockData;
  offset?: number;
}


export interface IBlockDefinition {
  name: string;

  editable?: boolean;

  onBlockCreated(model: BlockData): Block;

  /**
   * if a block's type is [[Text]],
   * this method must be provided.
   * 
   * A text block must have a child element to contain
   * the text content.
   */
  findContentContainer?(parent: HTMLElement): HTMLElement;

  onContainerCreated?(e: BlockCreatedEvent): void;

  /**
   * Handle the block is focused.
   * 
   * This hook will only be triggered when the focused id is
   * equal to the block'id. The children is out of situation.
   * 
   */
  onBlockFocused?(e: BlockFocusedEvent): void;

  onBlockContentChanged?(e: BlockContentChangedEvent): void;

  blockWillUnmount?(container: HTMLElement): void;

}

export class Block implements IDisposable {

  onBlockFocused(e: BlockFocusedEvent): void {}

  render(container: HTMLElement, editorController: EditorController) {}

  dispose(): void {}

}
