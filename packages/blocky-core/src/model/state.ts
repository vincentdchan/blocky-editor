import { makeObservable } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import type { DocNode, Block, Span } from "./nodes";
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
  toNodeBlock,
  toNodeSpan,
  MNode,
} from "./markup";
import { type CursorState } from "@pkg/model/cursor";
import { BlockRegistry } from "@pkg/registry/blockRegistry";

const DummyTextContentId = "block-text-content";

function createBlockWithContent(line: Block): TreeNode<DocNode> {
  const lineNode: TreeNode<Block> = createNode(line);

  const lineContentNode: TreeNode<DocNode> = createNode({
    t: "block-text-content",
    id: DummyTextContentId,
  });

  appendChild(lineNode, lineContentNode);

  return lineNode;
}

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
            const modelLine = toNodeBlock(node);
            const treeNode: TreeNode<DocNode> = createBlockWithContent(modelLine);
            appendChild(parentNode!, treeNode);
            nextNode = treeNode;
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
  public readonly newBlockInserted: Slot<Block> = new Slot;
  public readonly blockDeleted: Slot<Block> = new Slot;
  public cursorState: CursorState | undefined;

  constructor(public readonly root: TreeRoot<DocNode>, public readonly blockRegistry: BlockRegistry) {
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
      case "update-span": {
        const node = this.idMap.get(action.targetId);
        if (!node) {
          throw new Error(
            "can not apply action, id not found: " + action.targetId,
          );
        }

        Object.assign(node.data, action.value);
        break;
      }

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

        const newBlock: Block = {
          t: "block",
          id: action.newId,
          flags: blockId,
          data: action.data,
        };

        const blockNode = createBlockWithContent(newBlock);
        this.insertNode(blockNode);

        if (blockId === 0) {
          const lineContentNode = blockNode.firstChild!;

          const { spans } = action;
          if (spans) {
            for (const span of spans) {
              const spanNode: TreeNode<DocNode> = createNode(span);
              this.insertNode(spanNode);
              appendChild(lineContentNode, spanNode);
            }
          }
        }

        insertAfter(node, blockNode, afterNode);

        this.newBlockInserted.emit(newBlock);
        break;
      }

      case "new-span": {
        const lineNode = this.idMap.get(action.targetId);
        if (!lineNode) {
          throw new Error(
            "can not apply action, id not found: " + action.targetId,
          );
        }
        const { content, afterId } = action;
        const spanNode: TreeNode<DocNode> = createNode(content);
        this.insertNode(spanNode);

        const afterNode = afterId ? this.idMap.get(afterId) : undefined;
        insertAfter(lineNode.firstChild!, spanNode, afterNode);
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
    actions.push({
      type: "update-span",
      targetId: prevData.id,
      value: {
        content: newContent,
      },
    }, {
      type: "delete",
      targetId: currentData.id,
    });
    prevContent = newContent;
  });
}

export default State;
