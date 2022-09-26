import { TitleBlock } from "@pkg/block/titleBlock";
import { type BlockyNode } from "blocky-data";
import { EditorState } from "./editorState";

export class NodeTraverser {
  #node: BlockyNode | null;
  #endNode: BlockyNode | undefined;
  constructor(
    readonly state: EditorState,
    beginNode: BlockyNode,
    endNode?: BlockyNode
  ) {
    this.#node = beginNode;
    this.#endNode = endNode;
  }

  peek(): BlockyNode | null {
    return this.#node;
  }

  next(): BlockyNode | null {
    const current = this.#node;
    if (current === null) {
      return current;
    }

    if (current === this.#endNode) {
      return null;
    }

    if (current.nodeName === TitleBlock.Name) {
      this.#node = this.state.document.body.firstChild;
      return current;
    }

    if (current.firstChild) {
      this.#node = this.#findLeadingChildOfNode(current);
    } else if (current.nextSibling) {
      this.#node = current.nextSibling;
    } else {
      const parent = current.parent!;
      const nextOfParent = parent.nextSibling;
      if (nextOfParent === null) {
        this.#node = null;
      } else {
        this.#node = this.#findLeadingChildOfNode(nextOfParent);
      }
    }

    return current;
  }

  #findLeadingChildOfNode(node: BlockyNode): BlockyNode {
    while (node.firstChild !== null) {
      node = node.firstChild;
    }
    return node;
  }
}
