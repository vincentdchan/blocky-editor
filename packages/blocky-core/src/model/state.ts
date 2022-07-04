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

function jsonNodeToBlock(state: State, node: S.JSONNode): BlockElement {
  if (typeof node !== "object") {
    throw new TypeError("string is expected");
  }
  const { blockName, id } = node;
  if (!blockName) {
    throw new TypeError("blockName is expected");
  }
  if (!id) {
    throw new TypeError("id is expected");
  }
  const blockElement = new BlockElement(blockName, id);
  blockElement.state = state;
  blockElement.contentContainer.state = state;
  blockElement.childrenContainer.state = state;

  if (node.children && node.children.length > 0) {
    const firstChild = node.children[0];
    if (typeof firstChild === "object" && firstChild.nodeName === "block-content") {
      firstChildToContent(firstChild, blockElement);
    }
  }

  return blockElement;
}

function firstChildToContent(firstChild: S.JSONNode, blockyElement: BlockElement) {
  const textModel = new BlockyTextModel();
  if (!firstChild.children) {
    return;
  }
  let ptr = 0;
  for (const item of firstChild.children) {
    if (typeof item === "string") {
      textModel.insert(ptr, item);
      ptr += item.length;
    }
  }
  blockyElement.contentContainer.appendChild(textModel);
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
      if (typeof child === "object" && child.nodeName === "block") {
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
    result.contentContainer.appendChild(textModel);
    return result;
  }

  public handleNewBlockMounted(parent: BlockyElement, child: BlockyNode) {
    if (child.nodeName !== "block") {
      return;
    }
    const blockElement = child as BlockElement;

    this.insertElement(blockElement);

    const blockDef = this.blockRegistry.getBlockDefByName(
      blockElement.blockName
    );
    if (!blockDef) {
      throw new Error("invalid block name: " + blockElement.blockName);
    }

    const block = blockDef.onBlockCreated({ blockElement });

    this.blocks.set(blockElement.id, block);

    this.newBlockCreated.emit(block);
  }

  /**
   * TODO: recursive unmount block
   */
  public unmountBlock(parent: BlockyElement, child: BlockyNode): boolean {
    if (child.nodeName !== "block") {
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
