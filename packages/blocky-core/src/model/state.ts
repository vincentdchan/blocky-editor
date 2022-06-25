import { makeObservable } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import { BlockyElement } from "./tree";
import { type BlockyNode } from "./element";
import {
  MDoc,
  traverse,
  MNode,
} from "./markup";
import { type CursorState } from "@pkg/model/cursor";
import { Block, BlockElement } from "@pkg/block/basic";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { validate as validateNode } from "./validator";

class State {
  static fromMarkup(doc: MDoc, blockRegistry: BlockRegistry): State {
    const rootNode = new BlockyElement("doc");
    const state = new State(rootNode, blockRegistry);
    rootNode.state = state;

    traverse<BlockyNode>(
      doc,
      (node: MNode, parent?: MNode, parentNode?: BlockyNode) => {
        if (state.idMap.has(node.id)) {
          throw new Error(`duplicated id: ${node.id}`);
        }

        let nextNode: BlockyElement;

        switch (node.t) {
          case "doc": {
            nextNode = rootNode;
            break;
          }

          case "block": {
            const blockDef = blockRegistry.getBlockDefByName(node.blockName)!;

            const blockElement = new BlockElement(blockDef.name, node.id);
            blockElement.state = state;
            blockElement.contentContainer.state = state;
            blockElement.childrenContainer.state = state;

            if (node.data) {
              blockElement.contentContainer.appendChild(node.data);
            }

            const parentElement = parentNode as BlockElement;
            parentElement.appendChild(blockElement);

            const block = blockDef.onBlockCreated({ blockElement });
            state.newBlockCreated.emit(block);

            state.idMap.set(node.id, blockElement);
            state.blocks.set(node.id, block);

            nextNode = blockElement;
            break;
          }

          default: {
            throw new Error(`unknown node type: ${node}`);
          }
        }

        state.idMap.set(node.id, nextNode);

        return nextNode;
      },
      undefined,
      rootNode,
    );

    return state;
  }

  public readonly idMap: Map<string, BlockyElement> = new Map();
  public readonly domMap: Map<string, Node> = new Map();
  public readonly blocks: Map<string, Block> = new Map();
  public readonly newBlockInserted: Slot<BlockElement> = new Slot;
  public readonly newBlockCreated: Slot<Block> = new Slot;
  public readonly blockDeleted: Slot<BlockElement> = new Slot;
  public cursorState: CursorState | undefined;

  constructor(public readonly root: BlockyElement, public readonly blockRegistry: BlockRegistry) {
    validateNode(root);
    makeObservable(this, "cursorState");
  }

  public handleNewBlockMounted(parent: BlockyElement, child: BlockyNode) {
    if (child.nodeName === "block") {
      const blockElement = child as BlockElement;

      this.insertElement(blockElement);

      const blockDef = this.blockRegistry.getBlockDefByName(blockElement.blockName);
      if (!blockDef) {
        throw new Error("invalid block name: " + blockElement.blockName);
      }

      const block = blockDef.onBlockCreated({ blockElement });
      this.newBlockCreated.emit(block);

      this.blocks.set(blockElement.id, block);

      this.newBlockInserted.emit(child as BlockElement);
    }
  }

  public deleteBlock(blockId: string): boolean {
    const element = this.idMap.get(blockId) as BlockElement | undefined;
    if (!element) {
      return false;
    }
    const parentElement = element.parent! as BlockyElement;
    parentElement.removeChild(element);

    this.idMap.delete(blockId);
    this.domMap.delete(blockId);

    this.blockDeleted.emit(element);
    return true;
  }

  private insertElement(element: BlockElement) {
    if (this.idMap.has(element.id)) {
      throw new Error(`duplicated id: ${element.id}`);
    }
    this.idMap.set(element.id, element);
  }
}

export default State;
