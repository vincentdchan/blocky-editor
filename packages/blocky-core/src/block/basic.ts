import type { TreeNode, DocNode } from "@pkg/model";

export enum BlockContentType {
  Text,
  Custom,
}

export interface SpanCreatedEvent {
  element: HTMLElement;
  clsPrefix: string;
  node: TreeNode<DocNode>;
}

export interface IBlockDefinition {
  name: string;
  type: BlockContentType;

  /**
   * if a block's type is [[Text]],
   * this method must be provided.
   * 
   * A text block must have a child element to contain
   * the text content.
   */
  findContentContainer?: (parent: HTMLElement) => HTMLElement;

  onContainerCreated?: (e: SpanCreatedEvent) => void;
}
