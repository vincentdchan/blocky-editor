import { makeObservable } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import type { DocNode, Span, BlockData } from "./nodes";
import {
  type TreeNode,
  type TreeRoot,
  createRoot,
  createNode,
  appendChild,
  insertAfter,
  removeNode,
  forEach,
} from "./tree";
import { Action } from "./actions";
import {
  MDoc,
  traverse,
  toNodeDoc,
  toNodeSpan,
  MNode,
} from "./markup";
import { type CursorState } from "@pkg/model/cursor";
import { type Block } from "@pkg/block/basic";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { validate as validateNode } from "./validator";
import { TextModel } from "./textModel";

class State {
  static fromMarkup(doc: MDoc, blockRegistry: BlockRegistry): State {
    const rootNode = createRoot<DocNode>(toNodeDoc(doc));
    const state = new State(rootNode, blockRegistry);

    traverse<TreeNode<DocNode>>(
      doc,
      (node: MNode, parent?: MNode, parentNode?: TreeNode<DocNode>) => {
        if (state.idMap.has(node.id)) {
          throw new Error(`duplicated id: ${node.id}`);
        }

        let nextNode: TreeNode<DocNode>;

        switch (node.t) {
          case "doc": {
            nextNode = rootNode;
            break;
          }

          case "block": {
            const blockData: BlockData = {
              t: "block",
              id: node.id,
              flags: node.flags,
              data: node.data,
            }
            const blockNode: TreeNode<BlockData> = createNode(blockData);
            appendChild(parentNode!, blockNode);

            const blockDef = blockRegistry.getBlockDefById(node.flags)!;
            const block = blockDef.onBlockCreated(blockData);

            state.idMap.set(node.id, blockNode);
            state.blocks.set(node.id, block);

            nextNode = blockNode;
            break;
          }

          case "span": {
            const modelSpan = toNodeSpan(node);
            const treeNode: TreeNode<Span> = createNode(modelSpan);
            appendChild(parentNode!.firstChild!, treeNode);
            nextNode = treeNode;
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

  public readonly idMap: Map<string, TreeNode<DocNode>> = new Map();
  public readonly domMap: Map<string, Node> = new Map();
  public readonly blocks: Map<string, Block> = new Map();
  public readonly newBlockInserted: Slot<BlockData> = new Slot;
  public readonly blockDeleted: Slot<BlockData> = new Slot;
  public cursorState: CursorState | undefined;

  constructor(public readonly root: TreeRoot<DocNode>, public readonly blockRegistry: BlockRegistry) {
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
    return wrapper?.parent?.data.id;
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

        const newBlock: BlockData = {
          t: "block",
          id: action.newId,
          flags: blockId,
          data: action.data,
        };
        const block = blockDef.onBlockCreated(newBlock);

        const blockNode = createNode(newBlock);
        this.insertNode(blockNode);

        this.blocks.set(action.newId, block);

        insertAfter(node, blockNode, afterNode);

        this.newBlockInserted.emit(newBlock);
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

        if (node.data.t === "block") {
          this.blockDeleted.emit(node.data);
        }
        break;
      }

      case "text-format": {
        const { targetId, index, length, attributes } = action;
        const blockNode = this.idMap.get(targetId) as TreeNode<BlockData>;
        const data = blockNode.data.data;
        if (data && data instanceof TextModel) {
          data.format(index, length, attributes);
        }
        break;
      }
    }
  }

  private insertNode(node: TreeNode<DocNode>) {
    if (this.idMap.has(node.data.id)) {
      throw new Error(`duplicated id: ${node.data.id}`);
    }
    this.idMap.set(node.data.id, node);
  }
}

export function normalizeLine(line: TreeNode<DocNode>, actions: Action[]) {
  if (line.data.t !== "block") {
    throw new Error("node is not a line");
  }

  const lineContentNode = line.firstChild;
  if (!lineContentNode) {
    return;
  }

  let prevNode: TreeNode<DocNode> | undefined;
  let prevContent: string | undefined;
  forEach(lineContentNode, (spanNode: TreeNode<DocNode>) => {
    if (!prevNode) {
      prevNode = spanNode;
      const prevData = prevNode.data as Span;
      prevContent = prevData.content;
      return;
    }

    const prevData = prevNode.data as Span;
    const currentData = spanNode.data as Span;
    if (prevData.flags !== currentData.flags) {
      prevNode = spanNode;
      prevContent = prevData.content;
      return;
    }

    const newContent = prevContent + currentData.content;
    // actions.push({
    //   type: "update-span",
    //   targetId: prevData.id,
    //   value: {
    //     content: newContent,
    //   },
    // }, {
    //   type: "delete",
    //   targetId: currentData.id,
    // });
    prevContent = newContent;
  });
}

export function serializeJSON(state: State): any {
  const { root } = state;
  return serializeTreeNode(root);
}

function serializeTreeNode(node: TreeNode<DocNode>): any {
  const { data } = node;

  let children: any[] | undefined;

  if (data.t !== "span") {
    children = [];
    let ptr = node.firstChild;
    while (ptr) {
      children.push(serializeTreeNode(ptr));

      ptr = ptr.next;
    }
  }

  const result: any = { ...data };
  if (children) {
    result.children = children;
  }

  return result;
}

export default State;
