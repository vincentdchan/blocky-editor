import {
  type DataBaseNode,
  type BlockyDocument,
  type BlockyTextModel,
  DataBaseElement,
  DataElement,
} from "./tree";
import { Subject } from "rxjs";
import { isNumber, isUndefined } from "lodash-es";
import {
  type FinalizedChangeset,
  type ChangesetApplyOptions,
  type ChangesetStateLogger,
  Changeset,
} from "./change";
import { NodeLocation } from "./location";
import { blockyNodeFromJsonNode } from "./deserialize";
import {
  type InsertNodeOperation,
  type UpdateNodeOperation,
  type RemoveNodeOperation,
  type TextEditOperation,
  transformOperation,
  transformCursorState,
} from "./operations";
import { VersionHistory } from "./versionHistory";
import { type CursorState } from "./cursor";

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
  prevState: CursorState | null;
  state: CursorState | null;
  reason: CursorStateUpdateReason;
}

export class State implements ChangesetStateLogger {
  readonly beforeChangesetApply: Subject<FinalizedChangeset> = new Subject();
  readonly changesetApplied: Subject<FinalizedChangeset> = new Subject();
  readonly versionHistory = new VersionHistory();
  readonly cursorStateChanged: Subject<CursorStateUpdateEvent> = new Subject();
  #appliedVersion: number;
  #cursorState: CursorState | null = null;

  constructor(
    readonly userId: string,
    readonly document: BlockyDocument,
    initVersion = 0
  ) {
    this.#appliedVersion = initVersion;
  }

  get cursorState(): CursorState | null {
    return this.#cursorState;
  }

  get appliedVersion(): number {
    return this.#appliedVersion;
  }

  __setCursorState(
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
    const prevState = this.#cursorState;
    this.#cursorState = cursorState;
    this.cursorStateChanged.next({
      prevState,
      state: cursorState,
      reason,
    });
  }

  getLocationOfNode(
    node: DataBaseNode,
    acc: (number | string)[] = []
  ): NodeLocation {
    if (this.document === node) {
      return new NodeLocation(acc.reverse());
    }
    const parent = node.parent;
    if (!parent) {
      throw new Error(`node have no parent: ${node.t}`);
    }

    const index = parent.pathOf(node);

    acc.push(index);
    return this.getLocationOfNode(parent, acc);
  }

  apply(changeset: FinalizedChangeset): boolean {
    if (this.#appliedVersion >= changeset.version) {
      return false;
    }
    this.beforeChangesetApply.next(changeset);

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
    this.changesetApplied.next(changeset);
    this.versionHistory.insert(changeset);
    return true;
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
    if (isNumber(index)) {
      const parent = this.findNodeByLocation(parentLoc) as DataBaseElement;
      // TODO: optimize insert
      for (const child of children) {
        if (parent instanceof DataElement) {
          parent.__insertChildAt(index++, blockyNodeFromJsonNode(child));
        }
      }
      return;
    }

    throw new Error(`can not insert node at: ${location.toString()}`);
  }

  #applyUpdateOperation(updateOperation: UpdateNodeOperation) {
    const { location, attributes } = updateOperation;
    const node = this.findNodeByLocation(location) as DataBaseElement;
    for (const key in attributes) {
      const value = attributes[key];
      node.__setAttribute(key, value);
    }
  }

  #applyRemoveOperation(removeOperation: RemoveNodeOperation) {
    const { location, children } = removeOperation;
    const parentLoc = location.slice(0, location.length - 1);
    const index = location.last;
    if (isNumber(index)) {
      const parent = this.findNodeByLocation(parentLoc) as DataBaseElement;
      if (parent instanceof DataElement) {
        parent.__deleteChildrenAt(index, children.length);
      }
      return;
    }

    throw new Error(`can not remove node at: ${location.toString()}`);
  }

  #applyTextEditOperation(textEditOperation: TextEditOperation) {
    const { location, delta } = textEditOperation;
    const node = this.findNodeByLocation(location) as DataBaseElement;
    const textNode = node.getAttribute(textEditOperation.key) as
      | BlockyTextModel
      | undefined;
    if (isUndefined(textNode)) {
      throw new Error(
        `can not get "${textEditOperation.key}" of element <${
          node.t
        }>, by location: ${location.toString()}`
      );
    }
    textNode.__applyDelta(delta);
  }

  findNodeByLocation(location: NodeLocation): DataBaseNode {
    const { path } = location;
    let ptr: DataBaseNode = this.document;
    for (let i = 0, len = path.length; i < len; i++) {
      const index = path[i];
      if (!(ptr instanceof DataBaseElement)) {
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
}
