import { isObject, isUndefined } from "lodash-es";
import Delta from "quill-delta-es";
import { isUpperCase } from "blocky-common/es/character";
import { removeNode } from "blocky-common/es/dom";
import { hashIntArrays } from "blocky-common/es/hash";
import { Slot } from "blocky-common/es/events";
import {
  type AttributesObject,
  type BlockyNode,
  type JSONNode,
  BlockElement,
  BlockyElement,
  BlockyDocument,
  BlockyTextModel,
  symSetAttribute,
  symInsertChildAt,
  symDeleteChildrenAt,
  symApplyDelta,
} from "./tree";
import { blockyNodeFromJsonNode } from "@pkg/model/deserialize";
import { Block } from "@pkg/block/basic";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { TextBlockName } from "@pkg/block/textBlock";
import type { FinalizedChangeset } from "@pkg/model/change";
import type { IdGenerator } from "@pkg/helper/idHelper";
import type { CursorState } from "@pkg/model/cursor";
import type {
  InsertNodeOperation,
  UpdateNodeOperation,
  RemoveNodeOperation,
  TextEditOperation,
} from "./operations";

export class NodeLocation {
  static equals(a: NodeLocation, b: NodeLocation): boolean {
    if (a.length !== b.length) {
      return false;
    }

    if (a.hashCode !== b.hashCode) {
      return false;
    }

    for (let i = 0, len = a.length; i < len; i++) {
      if (a.path[i] !== b.path[i]) {
        return false;
      }
    }

    return true;
  }
  #hashCode: number | undefined;
  readonly path: readonly number[];
  constructor(path: number[]) {
    this.path = Object.freeze(path);
  }
  get length() {
    return this.path.length;
  }
  toString() {
    return "[" + this.path.join(", ") + "]";
  }
  get hashCode() {
    if (isUndefined(this.#hashCode)) {
      this.#hashCode = hashIntArrays(this.path);
    }
    return this.#hashCode;
  }
}

export const symSetCursorState = Symbol("setCursorState");

export enum CursorStateUpdateReason {
  /**
   * The user changed the cursor manually through the changeset
   */
  setByUser = "setByUser",
  /**
   * handled by the browser, when the "input" event is trigger.
   */
  contentChanged = "contentChanged",
}

export interface CursorStateUpdateEvent {
  state: CursorState | null;
  reason: CursorStateUpdateReason;
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
    if (doc.nodeName !== "document") {
      throw new Error("the root nodeName is expected to 'document'");
    }

    const children: BlockyNode[] = [];
    doc.children?.forEach((child) => {
      if (isObject(child)) {
        const block = blockyNodeFromJsonNode(child);
        children.push(block);
      }
    });

    const document = new BlockyDocument({ bodyChildren: children });
    const state = new State(document, blockRegistry, idHelper);

    return state;
  }

  readonly idMap: Map<string, BlockyElement> = new Map();
  readonly domMap: Map<string, Node> = new Map();
  readonly blocks: Map<string, Block> = new Map();
  readonly newBlockCreated: Slot<Block> = new Slot();
  readonly blockDeleted: Slot<BlockElement> = new Slot();
  readonly beforeChangesetApply: Slot<FinalizedChangeset> = new Slot();
  readonly changesetApplied: Slot<FinalizedChangeset> = new Slot();
  readonly cursorStateChanged: Slot<CursorStateUpdateEvent> = new Slot();
  #cursorState: CursorState | null = null;
  silent = false;

  get cursorState(): CursorState | null {
    return this.#cursorState;
  }

  constructor(
    readonly document: BlockyDocument,
    readonly blockRegistry: BlockRegistry,
    readonly idHelper: IdGenerator
  ) {
    document.handleMountToBlock(this);
  }

  [symSetCursorState](
    cursorState: CursorState | null,
    reason: CursorStateUpdateReason
  ) {
    if (this.#cursorState === null && cursorState === null) {
      return;
    }
    if (
      this.#cursorState !== null &&
      cursorState !== null &&
      this.#cursorState.equals(cursorState)
    ) {
      return;
    }
    this.#cursorState = cursorState;
    this.cursorStateChanged.emit({
      state: cursorState,
      reason,
    });
  }

  apply(changeset: FinalizedChangeset) {
    this.beforeChangesetApply.emit(changeset);

    for (const op of changeset.operations) {
      switch (op.type) {
        case "op-insert-node": {
          this.#applyInsertOperation(op);
          break;
        }
        case "op-update-node": {
          this.#applyUpdateOperation(op);
          break;
        }
        case "op-remove-node": {
          this.#applyRemoveOperation(op);
          break;
        }
        case "op-text-edit": {
          this.#applyTextEditOperation(op);
          break;
        }
      }
    }

    this.changesetApplied.emit(changeset);
  }

  #applyInsertOperation(insertOperation: InsertNodeOperation) {
    const { parentLoc, children } = insertOperation;
    let { index } = insertOperation;
    const parent = this.findNodeByLocation(parentLoc) as BlockyElement;
    for (const child of children) {
      parent[symInsertChildAt](index++, child);
    }
  }
  #applyUpdateOperation(updateOperation: UpdateNodeOperation) {
    const { location, attributes } = updateOperation;
    const node = this.findNodeByLocation(location) as BlockyElement;
    for (const key in attributes) {
      const value = attributes[key];
      node[symSetAttribute](key, value);
    }
  }
  #applyRemoveOperation(removeOperation: RemoveNodeOperation) {
    const { parentLoc, index, children } = removeOperation;
    const parent = this.findNodeByLocation(parentLoc) as BlockyElement;
    parent[symDeleteChildrenAt](index, children.length);
  }
  #applyTextEditOperation(textEditOperation: TextEditOperation) {
    const { location, delta } = textEditOperation;
    const textNode = this.findNodeByLocation(location) as BlockyTextModel;
    textNode[symApplyDelta](delta);
  }

  createTextElement(
    delta?: Delta | undefined,
    attributes?: AttributesObject
  ): BlockElement {
    const textModel = new BlockyTextModel(delta);
    return new BlockElement(
      TextBlockName,
      this.idHelper.mkBlockId(),
      attributes,
      [textModel]
    );
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
    const { path } = location;
    let ptr: BlockyNode = this.document;
    for (let i = 0, len = path.length; i < len; i++) {
      const index = path[i];
      if (!(ptr instanceof BlockyElement)) {
        throw new Error(`Child is not a BlockyElement at: ${path.toString()}`);
      }
      const child = ptr.childAt(index);
      if (!child) {
        throw new Error(`Child not found at: ${path.toString()}`);
      }
      ptr = child;
    }

    return ptr;
  }

  getLocationOfNode(node: BlockyNode, acc: number[] = []): NodeLocation {
    if (this.document === node) {
      return new NodeLocation(acc.reverse());
    }
    const parent = node.parent;
    if (!parent) {
      throw new Error(`node have no parent: ${node.nodeName}`);
    }

    let cnt = 0;
    let ptr = node.prevSibling;
    while (ptr) {
      cnt++;
      ptr = ptr.prevSibling;
    }

    acc.push(cnt);
    return this.getLocationOfNode(parent, acc);
  }

  toJSON() {
    const result: JSONNode = {
      nodeName: "document",
    };

    let ptr = this.document.firstChild;

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
