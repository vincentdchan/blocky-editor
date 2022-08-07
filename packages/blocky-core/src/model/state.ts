import { isUndefined } from "lodash-es";
import Delta from "quill-delta-es";
import { removeNode } from "blocky-common/es/dom";
import { Slot } from "blocky-common/es/events";
import {
  type AttributesObject,
  type BlockyNode,
  type JSONNode,
  BlockElement,
  BlockyElement,
  BlockyDocument,
  BlockyTextModel,
  traverseNode,
  CursorState,
  NodeLocation,
  InsertNodeOperation,
  UpdateNodeOperation,
  RemoveNodeOperation,
  TextEditOperation,
  transformOperation,
  transformCursorState,
} from "blocky-data";
import { blockyNodeFromJsonNode } from "./deserialize";
import { Block } from "@pkg/block/basic";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { TextBlock } from "@pkg/block/textBlock";
import { TitleBlock } from "@pkg/block/titleBlock";
import { VersionHistory } from "./versionHistory";
import {
  Changeset,
  FinalizedChangeset,
  type ChangesetApplyOptions,
} from "@pkg/model/change";
import type { IdGenerator } from "@pkg/helper/idHelper";

export const symSetCursorState = Symbol("setCursorState");

export enum CursorStateUpdateReason {
  /**
   * The user changed the cursor manually through the changeset
   */
  changeset = "changeset",
  /**
   * handled by the browser, when the "input" event is trigger.
   */
  contentChanged = "contentChanged",
  /**
   * UI Event
   */
  uiEvent = "uiEvent",
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
  #idMap: Map<string, BlockElement> = new Map();
  readonly domMap: Map<string, Node> = new Map();
  readonly blocks: Map<string, Block> = new Map();
  readonly newBlockCreated: Slot<Block> = new Slot();
  readonly blockDeleted: Slot<BlockElement> = new Slot();
  readonly beforeChangesetApply: Slot<FinalizedChangeset> = new Slot();
  readonly changesetApplied: Slot<FinalizedChangeset> = new Slot();
  readonly cursorStateChanged: Slot<CursorStateUpdateEvent> = new Slot();
  readonly versionHistory = new VersionHistory();
  #cursorState: CursorState | null = null;
  #appliedVersion = 0;
  silent = false;

  get cursorState(): CursorState | null {
    return this.#cursorState;
  }

  constructor(
    readonly userId: string,
    readonly document: BlockyDocument,
    readonly blockRegistry: BlockRegistry,
    readonly idHelper: IdGenerator
  ) {
    traverseNode(document, (node: BlockyNode) => {
      if (node instanceof BlockElement) {
        this.#handleNewBlockMounted(node);
      }
    });

    document.blockElementAdded.on((blockElement: BlockElement) =>
      this.#handleNewBlockMounted(blockElement)
    );
    document.blockElementRemoved.on((blockElement: BlockElement) =>
      this.#unmountBlock(blockElement)
    );
  }

  get appliedVersion(): number {
    return this.#appliedVersion;
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

  getBlockElementById(id: string): BlockElement | undefined {
    return this.#idMap.get(id);
  }

  containsBlockElement(id: string): boolean {
    return this.#idMap.has(id);
  }

  isTextLike(node: BlockyNode) {
    return (
      node.nodeName === TextBlock.Name || node.nodeName === TitleBlock.Name
    );
  }

  apply(changeset: FinalizedChangeset) {
    if (this.#appliedVersion >= changeset.version) {
      return;
    }
    this.beforeChangesetApply.emit(changeset);

    for (const operation of changeset.operations) {
      switch (operation.op) {
        case "insert-nodes": {
          this.#applyInsertOperation(operation);
          break;
        }
        case "update-attributes": {
          this.#applyUpdateOperation(operation);
          break;
        }
        case "remove-nodes": {
          this.#applyRemoveOperation(operation);
          break;
        }
        case "text-edit": {
          this.#applyTextEditOperation(operation);
          break;
        }
      }
    }

    this.#appliedVersion = changeset.version;
    this.changesetApplied.emit(changeset);
    this.versionHistory.insert(changeset);
  }

  rebase(
    changeset: FinalizedChangeset,
    options?: Partial<ChangesetApplyOptions>
  ): FinalizedChangeset {
    if (changeset.version > this.#appliedVersion) {
      return changeset;
    }

    for (let i = changeset.version; i <= this.#appliedVersion; i++) {
      changeset = this.#rebaseVersion(i, changeset, options);
    }

    return changeset;
  }

  #rebaseVersion(
    version: number,
    changeset: FinalizedChangeset,
    options?: Partial<ChangesetApplyOptions>
  ): FinalizedChangeset {
    const rebasedChange = new Changeset(this);
    rebasedChange.version = version + 1;
    let { beforeCursor, afterCursor } = changeset;
    const item = this.versionHistory.get(version)!;

    for (let i = 0; i < changeset.operations.length; i++) {
      let op = changeset.operations[i];

      for (let j = 0; j < item.operations.length; j++) {
        op = transformOperation(item.operations[j], op);
      }

      rebasedChange.pushWillMerge(op);
    }

    for (let j = 0; j < item.operations.length; j++) {
      beforeCursor = transformCursorState(item.operations[j], beforeCursor);
      if (!isUndefined(afterCursor)) {
        afterCursor = transformCursorState(item.operations[j], afterCursor);
      }
    }

    rebasedChange.beforeCursor = beforeCursor;
    rebasedChange.afterCursor = afterCursor;

    return rebasedChange.finalize(options);
  }

  #applyInsertOperation(insertOperation: InsertNodeOperation) {
    const { location, children } = insertOperation;
    const parentLoc = location.slice(0, location.length - 1);
    let index = location.last;
    const parent = this.findNodeByLocation(parentLoc) as BlockyElement;
    // TODO: optimize insert
    for (const child of children) {
      parent.__insertChildAt(index++, blockyNodeFromJsonNode(child));
    }
  }
  #applyUpdateOperation(updateOperation: UpdateNodeOperation) {
    const { location, attributes } = updateOperation;
    const node = this.findNodeByLocation(location) as BlockyElement;
    for (const key in attributes) {
      const value = attributes[key];
      node.__setAttribute(key, value);
    }
  }
  #applyRemoveOperation(removeOperation: RemoveNodeOperation) {
    const { location, children } = removeOperation;
    const parentLoc = location.slice(0, location.length - 1);
    const index = location.last;
    const parent = this.findNodeByLocation(parentLoc) as BlockyElement;
    parent.__deleteChildrenAt(index, children.length);
  }
  #applyTextEditOperation(textEditOperation: TextEditOperation) {
    const { location, delta } = textEditOperation;
    const node = this.findNodeByLocation(location) as BlockyElement;
    const textNode = node.getAttribute(textEditOperation.key) as
      | BlockyTextModel
      | undefined;
    if (isUndefined(textNode)) {
      throw new Error(
        `can not get "${textEditOperation.key}" of element <${
          node.nodeName
        }>, by location: ${location.toString()}`
      );
    }
    textNode.__applyDelta(delta);
  }

  createTextElement(
    delta?: Delta | undefined,
    attributes?: AttributesObject,
    children?: BlockyNode[]
  ): BlockElement {
    if (isUndefined(attributes)) {
      attributes = {};
    }
    if (isUndefined(attributes.textContent)) {
      attributes.textContent = new BlockyTextModel(delta);
    }
    return new BlockElement(
      TextBlock.Name,
      this.idHelper.mkBlockId(),
      attributes,
      children
    );
  }

  #handleNewBlockMounted(blockElement: BlockElement) {
    this.#insertElement(blockElement);

    if (blockElement.nodeName === "Title") {
      const titleBlock = new TitleBlock(blockElement);
      this.blocks.set(blockElement.id, titleBlock);
      return;
    }
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

  #unmountBlock(blockElement: BlockElement): boolean {
    const blockId = blockElement.id;

    const dom = this.domMap.get(blockId);
    if (dom) {
      removeNode(dom);
    }

    this.#idMap.delete(blockId);
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
    const { id } = element;
    if (isUndefined(id)) {
      throw new Error(
        `id could NOT be undefined for a BlockElement: ${element.nodeName}`
      );
    }
    if (this.#idMap.has(id)) {
      throw new Error(`duplicated id: ${element.id}`);
    }
    this.#idMap.set(element.id, element);
  }

  /**
   * Split cursor states into multiple states crossing the document.
   */
  splitCursorStateByBlocks(state: CursorState): CursorState[] {
    if (state.isCollapsed) {
      return [state];
    }
    if (state.startId === state.endId) {
      return [state];
    }
    const startNode = this.#idMap.get(state.startId)!;
    const endNode = this.#idMap.get(state.endId)!;
    const traverser = new NodeTraverser(this, startNode);
    const result: CursorState[] = [];

    while (traverser.peek()) {
      const currentNode = traverser.next()!;
      if (currentNode instanceof BlockElement) {
        let startOffset = 0;
        let endOffset = 0;
        if (currentNode.nodeName === TextBlock.Name) {
          const textModel = currentNode.getAttribute(
            "textContent"
          ) as BlockyTextModel;

          if (currentNode === startNode) {
            startOffset = state.startOffset;
          }

          if (currentNode === endNode) {
            endOffset = state.endOffset;
          } else {
            endOffset = textModel.length;
          }
        }
        result.push(
          new CursorState(
            currentNode.id,
            startOffset,
            currentNode.id,
            endOffset
          )
        );
      }
      if (currentNode === endNode) {
        break;
      }
    }

    return result;
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

export class NodeTraverser {
  #node: BlockyNode | null;
  constructor(readonly state: State, beginNode: BlockyNode) {
    this.#node = beginNode;
  }

  peek(): BlockyNode | null {
    return this.#node;
  }

  next() {
    const current = this.#node;
    if (current === null) {
      return current;
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
