import { isUpperCase } from "blocky-common/src/character";
import { makeObservable } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import { BlockyElement, BlockyTextModel } from "./tree";
import { type BlockyNode } from "./element";
import * as S from "./serialize";
import { TextBlockName } from "@pkg/block/textBlock";
import { type IdGenerator } from "@pkg/helper/idHelper";
import { type CursorState } from "@pkg/model/cursor";
import { Block, BlockElement } from "@pkg/block/basic";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { validate as validateNode } from "./validator";

function jsonNodeToBlock(state: State, node: S.JSONNode): BlockyNode {
  if (typeof node !== "object") {
    throw new TypeError("string is expected");
  }
  const { nodeName, id } = node;
  if (isUpperCase(nodeName) && typeof id === "undefined") {
    throw new TypeError("id is expected for node: " + nodeName);
  }
  if (nodeName === "#text") {
    const textModel = new BlockyTextModel();

    let index = 0;
    for (const delta of node.textContent!) {
      const d = delta;
      if (typeof d.insert === "string") {
        textModel.insert(index, d.insert, d.attributes);
        index += d.insert.length;
      } else if (typeof d.retain === "number") {
        index += d.retain;
      }
    }

    return textModel;
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

class State {
  static fromMarkup(
    doc: S.JSONNode,
    blockRegistry: BlockRegistry,
    idHelper: IdGenerator
  ): State {
    const rootNode = new BlockyElement("doc");
    const state = new State(rootNode, blockRegistry, idHelper);
    rootNode.state = state;

    if (doc.nodeName !== "document") {
      throw new Error("the root nodeName is expected to 'document'");
    }

    doc.children?.forEach(child => {
      if (typeof child === "object") {
        const block = jsonNodeToBlock(state, child);
        rootNode.appendChild(block);
      }
    });

    return state;
  }

  public readonly idMap: Map<string, BlockyElement> = new Map();
  public readonly domMap: Map<string, Node> = new Map();
  public readonly blocks: Map<string, Block> = new Map();
  public readonly newBlockCreated: Slot<Block> = new Slot();
  public readonly blockDeleted: Slot<BlockElement> = new Slot();
  public cursorState: CursorState | undefined;
  public silent = false;

  constructor(
    public readonly root: BlockyElement,
    public readonly blockRegistry: BlockRegistry,
    public readonly idHelper: IdGenerator
  ) {
    validateNode(root);
    makeObservable(this, "cursorState");
  }

  public createTextElement(): BlockElement {
    const result = new BlockElement(
      TextBlockName,
      this.idHelper.mkBlockId()
    );
    const textModel = new BlockyTextModel();
    result.appendChild(textModel);
    return result;
  }

  public handleNewBlockMounted(parent: BlockyElement, child: BlockyNode) {
    if (!isUpperCase(child.nodeName)) {
      return;
    }
    const blockElement = child as BlockElement;

    this.insertElement(blockElement);

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

  /**
   * TODO: recursive unmount block
   */
  public unmountBlock(parent: BlockyElement, child: BlockyNode): boolean {
    if (!isUpperCase(child.nodeName)) {
      return false;
    }
    const blockElement = child as BlockElement;
    const blockId = blockElement.id;

    this.idMap.delete(blockId);
    this.domMap.delete(blockId);

    this.blockDeleted.emit(blockElement);
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
