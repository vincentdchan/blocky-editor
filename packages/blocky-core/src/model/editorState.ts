import { isUndefined } from "lodash-es";
import { Subject, takeUntil } from "rxjs";
import {
  type AttributesObject,
  type DataBaseNode,
  type JSONNode,
  BlockDataElement,
  BlockyDocument,
  BlockyTextModel,
  traverseNode,
  CursorState,
  State,
  Delta,
} from "blocky-data";
import { Block } from "@pkg/block/basic";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { TextBlock } from "@pkg/block/textBlock";
import { TitleBlock } from "@pkg/block/titleBlock";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";

export interface IEditorStateInitOptions {
  userId: string;
  document: BlockyDocument;
  initVersion?: number;
  blockRegistry?: BlockRegistry;
  idGenerator?: IdGenerator;
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
export class EditorState extends State {
  #idMap: Map<string, BlockDataElement> = new Map();
  readonly domMap: Map<string, Node> = new Map();
  readonly blocks: Map<string, Block> = new Map();
  readonly newBlockCreated: Subject<Block> = new Subject();
  readonly blockWillDelete: Subject<BlockDataElement> = new Subject();
  readonly blockRegistry: BlockRegistry;
  readonly idGenerator: IdGenerator;
  readonly dispose$ = new Subject<void>();
  silent = false;

  constructor(options: IEditorStateInitOptions) {
    super(options.userId, options.document, options.initVersion);
    this.blockRegistry = options.blockRegistry ?? new BlockRegistry();
    this.idGenerator = options.idGenerator ?? makeDefaultIdGenerator();
    const { document } = options;

    traverseNode(document, (node: DataBaseNode) => {
      if (node instanceof BlockDataElement) {
        this.#handleNewBlockMounted(node);
      }
    });

    document.blockElementAdded
      .pipe(takeUntil(this.dispose$))
      .subscribe((blockElement: BlockDataElement) =>
        this.#handleNewBlockMounted(blockElement)
      );
    document.blockElementRemoved
      .pipe(takeUntil(this.dispose$))
      .subscribe((blockElement: BlockDataElement) =>
        this.#unmountBlock(blockElement)
      );
  }

  getBlockElementById(id: string): BlockDataElement | undefined {
    return this.#idMap.get(id);
  }

  containsBlockElement(id: string): boolean {
    return this.#idMap.has(id);
  }

  isTextLike(node: DataBaseNode) {
    return (
      node.nodeName === TextBlock.Name || node.nodeName === TitleBlock.Name
    );
  }

  createTextElement(
    delta?: Delta | undefined,
    attributes?: AttributesObject,
    children?: DataBaseNode[]
  ): BlockDataElement {
    if (isUndefined(attributes)) {
      attributes = {};
    }
    if (isUndefined(attributes.textContent)) {
      attributes.textContent = new BlockyTextModel(delta);
    }
    return new BlockDataElement(
      TextBlock.Name,
      this.idGenerator.mkBlockId(),
      attributes,
      children
    );
  }

  #handleNewBlockMounted(blockElement: BlockDataElement) {
    this.#insertElement(blockElement);

    if (blockElement.nodeName === "Title") {
      const titleBlock = new TitleBlock({ blockElement });
      this.blocks.set(blockElement.id, titleBlock);
      return;
    }
    const blockDef = this.blockRegistry.getBlockDefByName(
      blockElement.nodeName
    );
    if (!blockDef) {
      throw new Error("invalid block name: " + blockElement.nodeName);
    }

    const block = new blockDef({ blockElement });

    this.blocks.set(blockElement.id, block);

    this.newBlockCreated.next(block);
  }

  #unmountBlock(blockElement: BlockDataElement): boolean {
    const blockId = blockElement.id;
    this.blockWillDelete.next(blockElement);

    this.#idMap.delete(blockId);
    this.domMap.delete(blockId);

    return true;
  }

  setDom(blockId: string, dom: HTMLElement) {
    if (this.domMap.has(blockId)) {
      throw new Error(`duplicated dom: ${blockId}`);
    }
    this.domMap.set(blockId, dom);
  }

  #insertElement(element: BlockDataElement) {
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
      if (currentNode instanceof BlockDataElement) {
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

  dispose() {
    this.dispose$.next();
  }
}

export class NodeTraverser {
  #node: DataBaseNode | null;
  constructor(readonly state: EditorState, beginNode: DataBaseNode) {
    this.#node = beginNode;
  }

  peek(): DataBaseNode | null {
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

  #findLeadingChildOfNode(node: DataBaseNode): DataBaseNode {
    while (node.firstChild !== null) {
      node = node.firstChild;
    }
    return node;
  }
}
