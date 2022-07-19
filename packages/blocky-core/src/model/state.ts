import { isObject, isUndefined } from "lodash-es";
import Delta from "quill-delta-es";
import { isUpperCase } from "blocky-common/es/character";
import { makeObservable } from "blocky-common/es/observable";
import { removeNode } from "blocky-common/es/dom";
import { Slot } from "blocky-common/es/events";
import { BlockyElement, BlockyTextModel } from "./tree";
import type { BlockyNode, JSONNode } from "./element";
import { TextBlockName } from "@pkg/block/textBlock";
import { type IdGenerator } from "@pkg/helper/idHelper";
import { type CursorState } from "@pkg/model/cursor";
import { UndoManager } from "@pkg/model/undoManager";
import { Block, BlockElement } from "@pkg/block/basic";
import { BlockRegistry } from "@pkg/registry/blockRegistry";

function jsonNodeToBlock(state: State, node: JSONNode): BlockyNode {
  if (!isObject(node)) {
    throw new TypeError("object is expected");
  }
  const { nodeName, id } = node;
  if (isUpperCase(nodeName) && isUndefined(id)) {
    throw new TypeError("id is expected for node: " + nodeName);
  }
  if (nodeName === "#text") {
    const delta = new Delta();

    for (const d of node.textContent!) {
      delta.push(d);
    }

    return new BlockyTextModel(delta);
  }

  const blockElement = new BlockElement(nodeName, id!);
  blockElement.state = state;

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      blockElement.appendChild(jsonNodeToBlock(state, child));
    }
  }

  return blockElement;
}

export const DocNodeName = "doc";

export interface NodeLocation {
  id?: string;
  path: number[];
}

/**
 * This class is used to store all the states
 * used to render the editor. Including:
 *
 * - Document tree
 * - Cursor
 * - Instances of blocks
 *
 */
export class State {
  static fromMarkup(
    doc: JSONNode,
    blockRegistry: BlockRegistry,
    idHelper: IdGenerator
  ): State {
    const rootNode = new BlockyElement(DocNodeName);
    const state = new State(rootNode, blockRegistry, idHelper);
    rootNode.state = state;

    if (doc.nodeName !== "document") {
      throw new Error("the root nodeName is expected to 'document'");
    }

    doc.children?.forEach((child) => {
      if (isObject(child)) {
        const block = jsonNodeToBlock(state, child);
        rootNode.appendChild(block);
      }
    });

    return state;
  }

  readonly idMap: Map<string, BlockyElement> = new Map();
  readonly domMap: Map<string, Node> = new Map();
  readonly blocks: Map<string, Block> = new Map();
  readonly newBlockCreated: Slot<Block> = new Slot();
  readonly blockDeleted: Slot<BlockElement> = new Slot();
  readonly undoManager: UndoManager;
  cursorState: CursorState | undefined;
  silent = false;

  constructor(
    readonly root: BlockyElement,
    readonly blockRegistry: BlockRegistry,
    readonly idHelper: IdGenerator
  ) {
    this.undoManager = new UndoManager(this);
    makeObservable(this, "cursorState");
  }

  createTextElement(): BlockElement {
    const result = new BlockElement(TextBlockName, this.idHelper.mkBlockId());
    const textModel = new BlockyTextModel();
    result.appendChild(textModel);
    return result;
  }

  handleNewBlockMounted(child: BlockyNode) {
    if (!isUpperCase(child.nodeName)) {
      return;
    }
    const blockElement = child as BlockElement;

    this.#insertElement(blockElement);

    const blockDef = this.blockRegistry.getBlockDefByName(
      blockElement.nodeName
    );
    if (!blockDef) {
      throw new Error("invalid block name: " + blockElement.nodeName);
    }

    const block = blockDef.onBlockCreated({ blockElement });

    this.blocks.set(blockElement.id, block);

    this.newBlockCreated.emit(block);
  }

  unmountBlock(child: BlockyNode): boolean {
    if (!isUpperCase(child.nodeName)) {
      return false;
    }
    const blockElement = child as BlockElement;
    const blockId = blockElement.id;

    const dom = this.domMap.get(blockId);
    if (dom) {
      removeNode(dom);
    }

    this.idMap.delete(blockId);
    this.domMap.delete(blockId);

    this.blockDeleted.emit(blockElement);
    return true;
  }

  setDom(blockId: string, dom: HTMLElement) {
    if (this.domMap.has(blockId)) {
      throw new Error(`duplicated dom: ${blockId}`);
    }
    this.domMap.set(blockId, dom);
  }

  #insertElement(element: BlockElement) {
    if (this.idMap.has(element.id)) {
      throw new Error(`duplicated id: ${element.id}`);
    }
    this.idMap.set(element.id, element);
  }

  findNodeByLocation(location: NodeLocation): BlockyNode {
    let baseNode: BlockyElement;
    if (isUndefined(location.id)) {
      baseNode = this.root;
    } else {
      const block = this.idMap.get(location.id);
      if (!block) {
        throw new Error(`is not exist: ${location.id}`);
      }
      baseNode = block;
    }

    return this.#findPathInNode(location.id, baseNode, location.path);
  }

  #findPathInNode(
    id: string | undefined,
    baseNode: BlockyElement,
    path: number[]
  ): BlockyNode {
    let ptr: BlockyNode = baseNode;
    for (let i = 0, len = path.length; i < len; i++) {
      const index = path[i];
      if (!(ptr instanceof BlockyElement)) {
        throw new Error(
          `Child is not a BlockyElement at: ${id}, [${path
            .slice(0, i + 1)
            .join(", ")}]`
        );
      }
      const child = ptr.childAt(index);
      if (!child) {
        throw new Error(
          `Child not found at: ${id}, [${path.slice(0, i + 1).join(", ")}]`
        );
      }
      ptr = child;
    }

    return ptr;
  }

  toJSON() {
    const result: JSONNode = {
      nodeName: "document",
    };

    let ptr = this.root.firstChild;

    // empty
    if (!ptr) {
      return result;
    }

    const children: JSONNode[] = [];

    while (ptr) {
      children.push(ptr.toJSON());
      ptr = ptr.nextSibling;
    }

    result.children = children;
    return result;
  }
}
