import { makeObservable } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import {
  type TreeNode,
  type TreeRoot,
  createNode,
  appendChild,
  insertAfter,
  removeNode,
} from "./tree";
import { Action } from "./actions";
import {
  MDoc,
  traverse,
  toNodeDoc,
  MNode,
} from "./markup";
import { type CursorState } from "@pkg/model/cursor";
import { Block } from "@pkg/block/basic";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { validate as validateNode } from "./validator";
import { TextModel } from "./textModel";
import { IModelElement } from "./element";

class State {
  static fromMarkup(doc: MDoc, blockRegistry: BlockRegistry): State {
    const rootNode = toNodeDoc(doc);
    const state = new State(rootNode, blockRegistry);

    traverse<TreeNode>(
      doc,
      (node: MNode, parent?: MNode, parentNode?: TreeNode) => {
        if (state.idMap.has(node.id)) {
          throw new Error(`duplicated id: ${node.id}`);
        }

        let nextNode: TreeNode;

        switch (node.t) {
          case "doc": {
            nextNode = rootNode;
            break;
          }

          case "block": {
            const blockNode: TreeNode = createNode(node.id, node.flags, node.data!);
            appendChild(parentNode!, blockNode);

            const blockDef = blockRegistry.getBlockDefById(node.flags)!;
            const block = blockDef.onBlockCreated({ model: blockNode });
            state.newBlockCreated.emit(block);

            state.idMap.set(node.id, blockNode);
            state.blocks.set(node.id, block);

            nextNode = blockNode;
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

  public readonly idMap: Map<string, TreeNode> = new Map();
  public readonly domMap: Map<string, Node> = new Map();
  public readonly blocks: Map<string, Block> = new Map();
  public readonly newBlockInserted: Slot<TreeNode> = new Slot;
  public readonly newBlockCreated: Slot<Block> = new Slot;
  public readonly blockDeleted: Slot<TreeNode> = new Slot;
  public cursorState: CursorState | undefined;

  constructor(public readonly root: TreeRoot, public readonly blockRegistry: BlockRegistry) {
    validateNode(root);
    makeObservable(this, "cursorState");
  }

  public deleteById(id: string) {
    this.idMap.delete(id);
    // TODO: remove all children
    this.domMap.delete(id);
  }

  public getParent(id: string): undefined | string {
    const wrapper = this.idMap.get(id);
    return wrapper?.parent?.id;
  }

  public applyActions(actions: Action[]) {
    for (const action of actions) {
      this.apply(action);
    }
  }

  private apply(action: Action) {
    switch (action.type) {
      case "new-block": {
        const node = this.idMap.get(action.targetId);
        if (!node) {
          throw new Error(
            "can not apply action, id not found: " + action.targetId,
          );
        }

        const afterNode = this.idMap.get(action.afterId);

        const { blockName } = action;
        const blockId = this.blockRegistry.getBlockIdByName(blockName);
        if (typeof blockId !== "number") {
          throw new Error(`block name '${blockName} not found'`);
        }

        const blockDef = this.blockRegistry.getBlockDefById(blockId)!;


        if (!action.data) {
          throw new Error("data is empty for new block");
        }
        const blockNode = createNode(action.newId, blockId, action.data);
        this.insertNode(blockNode);

        const block = blockDef.onBlockCreated({ model: blockNode });
        this.newBlockCreated.emit(block);

        this.blocks.set(action.newId, block);

        insertAfter(node, blockNode, afterNode);

        this.newBlockInserted.emit(blockNode);
        break;
      }

      case "delete": {
        const { targetId } = action;
        const node = this.idMap.get(targetId);
        if (!node) {
          return;
        }
        removeNode(node);

        this.idMap.delete(targetId);
        this.domMap.delete(targetId);

        this.blockDeleted.emit(node);
        break;
      }

      case "text-format": {
        const { targetId, index, length, attributes } = action;
        const blockNode = this.idMap.get(targetId) as TreeNode;
        const data = blockNode.data as IModelElement | undefined;
        if (data && data.nodeName === "text") {
          const textModel = data.firstChild! as TextModel;
          textModel.format(index, length, attributes);
        }
        break;
      }
    }
  }

  private insertNode(node: TreeNode) {
    if (this.idMap.has(node.id)) {
      throw new Error(`duplicated id: ${node.id}`);
    }
    this.idMap.set(node.id, node);
  }
}

export function serializeJSON(state: State): any {
  const { root } = state;
  return serializeTreeNode(root);
}

function serializeTreeNode(node: TreeNode): any {
  const { data } = node;

  let children: any[] | undefined;

  children = [];
  let ptr = node.firstChild;
  while (ptr) {
    children.push(serializeTreeNode(ptr));

    ptr = ptr.next;
  }

  const result: any = { ...data };
  if (children) {
    result.children = children;
  }

  return result;
}

export default State;
