import { $on, isContainNode, removeNode } from "blocky-common/es/dom";
import { isUpperCase } from "blocky-common/es/character";
import { observe } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import { type Padding } from "blocky-common/es/dom";
import { areEqualShallow } from "blocky-common/es/object";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import { type Position } from "blocky-common/es/position";
import { debounce, isUndefined } from "lodash-es";
import Delta from "quill-delta-es";
import fastDiff from "fast-diff";
import { DocRenderer } from "@pkg/view/renderer";
import {
  type AttributesObject,
  State as DocumentState,
  TextType,
  BlockyTextModel,
  BlockyElement,
  Changeset,
  BlockyNode,
} from "@pkg/model";
import {
  CollapsedCursor,
  OpenCursorState,
  type CursorState,
} from "@pkg/model/cursor";
import {
  IPlugin,
  PluginRegistry,
  type AfterFn,
} from "@pkg/registry/pluginRegistry";
import { SpanRegistry } from "@pkg/registry/spanRegistry";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { BannerDelegate, type BannerFactory } from "./bannerDelegate";
import { ToolbarDelegate, type ToolbarFactory } from "./toolbarDelegate";
import { TextBlockName } from "@pkg/block/textBlock";
import type { EditorController } from "./controller";
import {
  Block,
  BlockElement,
  BlockPasteEvent,
  TryParsePastedDOMEvent,
} from "@pkg/block/basic";
import { getTextTypeForTextBlock } from "@pkg/block/textBlock";
import {
  type CollaborativeCursorOptions,
  CollaborativeCursorManager,
} from "./collaborativeCursors";
import { HTMLConverter } from "@pkg/helper/htmlConverter";
import { isHotkey } from "is-hotkey";
import { FinalizedChangeset } from "@pkg/model/change";

const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export interface EditorRegistry {
  span: SpanRegistry;
  plugin: PluginRegistry;
  block: BlockRegistry;
}

export function makeDefaultEditorEntry(plugins?: IPlugin[]) {
  const plugin = new PluginRegistry(plugins);
  const span = new SpanRegistry();
  const block = new BlockRegistry();
  return { plugin, span, block };
}

export interface IEditorOptions {
  state: DocumentState;
  registry: EditorRegistry;
  container: HTMLDivElement;
  idGenerator?: IdGenerator;
  bannerFactory?: BannerFactory;
  toolbarFactory?: ToolbarFactory;
  padding?: Partial<Padding>;
  bannerXOffset?: number;
  collaborativeCursorOptions?: CollaborativeCursorOptions;
}

enum MineType {
  PlainText = "text/plain",
  Html = "text/html",
}

function makeDefaultPadding(): Padding {
  return {
    top: 12,
    right: 56,
    bottom: 72,
    left: 56,
  };
}

export enum UpdateFlag {
  IgnoreSelection = 0x01,
  NoLog = 0x02, // the update is commited by the program, do not log it
}

export class TextInputEvent {
  constructor(
    readonly beforeDelta: Delta,
    readonly diff: fastDiff.Diff[],
    readonly textModel: BlockyTextModel,
    readonly blockElement: BlockElement
  ) {}
}

/**
 * The internal view layer object of the editor.
 * It's not recommended to manipulate this class by the user.
 * The user should use `EditorController` to manipulate the editor.
 *
 * This class is designed to used internally. This class can be
 * used by the plugins to do something internally.
 */
export class Editor {
  #htmlConverter: HTMLConverter;
  #container: HTMLDivElement;
  #renderedDom: HTMLDivElement | undefined;
  #renderer: DocRenderer;
  #lastFocusedId: string | undefined;

  readonly onEveryBlock: Slot<Block> = new Slot();

  readonly bannerDelegate: BannerDelegate;
  readonly toolbarDelegate: ToolbarDelegate;
  idGenerator: IdGenerator;

  readonly anchorSpanClass: string = "blocky-text-anchor";

  readonly state: DocumentState;
  readonly registry: EditorRegistry;
  readonly keyDown = new Slot<KeyboardEvent>();
  readonly textInput = new Slot<TextInputEvent>();

  readonly preservedTextType: Set<TextType> = new Set([TextType.Bulleted]);

  readonly collaborativeCursorManager: CollaborativeCursorManager;

  readonly padding: Padding;
  private bannerXOffset: number;

  composing = false;
  private disposables: IDisposable[] = [];

  static fromController(
    container: HTMLDivElement,
    controller: EditorController
  ): Editor {
    const editor = new Editor(controller, {
      container,
      registry: {
        plugin: controller.pluginRegistry,
        span: controller.spanRegistry,
        block: controller.blockRegistry,
      },
      state: controller.state,
      bannerFactory: controller.options?.bannerFactory,
      toolbarFactory: controller.options?.toolbarFactory,
      padding: controller.options?.padding,
      bannerXOffset: controller.options?.bannerXOffset,
      collaborativeCursorOptions:
        controller.options?.collaborativeCursorOptions,
    });
    controller.mount(editor);
    return editor;
  }

  constructor(readonly controller: EditorController, options: IEditorOptions) {
    const {
      container,
      state,
      registry,
      idGenerator,
      bannerFactory,
      toolbarFactory,
      padding,
      bannerXOffset,
      collaborativeCursorOptions,
    } = options;
    this.state = state;
    this.registry = registry;
    this.#container = container;
    this.idGenerator = idGenerator ?? makeDefaultIdGenerator();

    this.#htmlConverter = new HTMLConverter({
      idGenerator: this.idGenerator,
      leafHandler: this.#leafHandler,
      divHandler: this.#divHandler,
    });

    this.padding = {
      ...makeDefaultPadding(),
      ...padding,
    };
    this.bannerXOffset = bannerXOffset ?? 24;

    this.collaborativeCursorManager = new CollaborativeCursorManager(
      collaborativeCursorOptions
    );
    this.collaborativeCursorManager.mount(this.#container);

    this.bannerDelegate = new BannerDelegate(controller, bannerFactory);
    this.bannerDelegate.mount(this.#container);
    this.disposables.push(this.bannerDelegate);

    this.toolbarDelegate = new ToolbarDelegate(controller, toolbarFactory);
    this.toolbarDelegate.mount(this.#container);
    this.disposables.push(this.toolbarDelegate);

    document.addEventListener("selectionchange", this.#selectionChanged);

    this.disposables.push(
      observe(state, "cursorState", this.handleCursorStateChanged)
    );

    this.disposables.push($on(container, "mouseleave", this.#hideBanner));

    this.registry.plugin.emitInitPlugins(this);

    this.#renderer = new DocRenderer({
      clsPrefix: "blocky",
      editor: this,
    });

    this.#initBlockCreated();

    this.state.beforeChangesetApply.on(this.#handleBeforeChangesetApply);
    this.state.changesetApplied.on(this.#handleChangesetApplied);
  }

  #leafHandler = (node: Node): BlockElement | void => {
    const blockRegistry = this.registry.block;

    const tryEvt = new TryParsePastedDOMEvent({
      editor: this,
      node: node as HTMLElement,
    });
    const testElement = blockRegistry.handlePasteElement(tryEvt);
    if (testElement) {
      return testElement;
    }

    const blockDef = blockRegistry.getBlockDefByName(TextBlockName);
    const pasteHandler = blockDef?.onPaste;
    const evt = new BlockPasteEvent({
      node: node as HTMLElement,
      editor: this,
      converter: this.#htmlConverter,
    });
    if (pasteHandler) {
      return pasteHandler.call(blockDef, evt);
    }
  };

  #divHandler = (node: Node): BlockElement | void => {
    const element = node as HTMLElement;
    const blockRegistry = this.registry.block;
    const dataType = element.getAttribute("data-type");
    if (!dataType) {
      return;
    }
    const blockDef = blockRegistry.getBlockDefByName(dataType);
    if (!blockDef) {
      return;
    }

    const pasteHandler = blockDef?.onPaste;
    if (pasteHandler) {
      const evt = new BlockPasteEvent({
        editor: this,
        node: element,
        converter: this.#htmlConverter,
      });
      return pasteHandler.call(blockDef, evt);
    }
  };

  #initBlockCreated() {
    this.disposables.push(
      this.onEveryBlock.on((block: Block) => {
        block.setEditor(this);
      })
    );

    for (const block of this.state.blocks.values()) {
      this.onEveryBlock.emit(block);
    }

    this.state.newBlockCreated.pipe(this.onEveryBlock);
  }

  drawCollaborativeCursor(
    id: string,
    name: string,
    color: string,
    state: CursorState | null
  ) {
    setTimeout(() => {
      if (!state) {
        this.collaborativeCursorManager.deleteById(id);
        return;
      }
      const cursor = this.collaborativeCursorManager.getOrInit(id);
      cursor.color = color;
      cursor.name = name;

      const containerRect = this.#container.getBoundingClientRect();
      if (state.type === "collapsed") {
        const blockId = state.targetId;
        const offset = state.offset;

        const block = this.state.blocks.get(blockId);
        if (!block) {
          this.collaborativeCursorManager.deleteById(id);
          return;
        }
        cursor.height = block.getCursorHeight();

        const cursorDom = block.getCursorDomByOffset?.(offset);
        if (!cursorDom) {
          this.collaborativeCursorManager.deleteById(id);
          return;
        }
        const range = document.createRange();
        range.setStart(cursorDom.node, cursorDom.offset);
        range.setEnd(cursorDom.node, cursorDom.offset);

        const rects = range.getClientRects();
        if (rects.length === 0) {
          return;
        }

        const firstRect = rects[0];

        cursor.drawCollapsedRect(
          firstRect.x - containerRect.x,
          firstRect.y - containerRect.y
        );
        return;
      }

      if (state.startId != state.endId) {
        return;
      }

      const block = this.state.blocks.get(state.startId);
      if (!block) {
        this.collaborativeCursorManager.deleteById(id);
        return;
      }

      cursor.height = block.getCursorHeight();

      const startCursorDom = block.getCursorDomByOffset?.(state.startOffset);
      const endCursorDom = block.getCursorDomByOffset?.(state.endOffset);
      if (!startCursorDom || !endCursorDom) {
        this.collaborativeCursorManager.deleteById(id);
        return;
      }
      const range = document.createRange();
      range.setStart(startCursorDom.node, startCursorDom.offset);
      range.setEnd(endCursorDom.node, endCursorDom.offset);

      const rects = [...range.getClientRects()].map((rect) => {
        return new DOMRect(
          rect.x - containerRect.x,
          rect.y - containerRect.y,
          rect.width,
          rect.height
        );
      });
      cursor.drawRects(rects);
    }, 15);
  }

  render(done?: AfterFn) {
    const newDom = this.#renderer.render(this.#renderedDom);
    if (!this.#renderedDom) {
      this.#container.appendChild(newDom);
      newDom.contentEditable = "true";

      $on(newDom, "input", () => {
        if (this.composing) {
          return;
        }
        this.#handleContentChanged();
      });
      $on(newDom, "compositionstart", this.#handleCompositionStart);
      $on(newDom, "compositionend", this.#handleCompositionEnd);
      $on(newDom, "keydown", this.#handleKeyDown);
      $on(newDom, "paste", this.#handlePaste);

      this.#renderedDom = newDom;
    }

    if (done) {
      done();
    } else {
      this.#selectionChanged();
    }

    this.controller.emitNextTicks();
  }

  #trySelectOnParent(startContainer: Node): boolean {
    const parent = startContainer.parentNode;
    if (!parent) {
      return false;
    }

    // parent is block
    if (
      parent instanceof HTMLElement &&
      parent.classList.contains(this.#renderer.blockClassName)
    ) {
      const node = parent._mgNode as BlockElement | undefined;
      if (!node) {
        return false;
      }

      this.state.cursorState = {
        type: "collapsed",
        targetId: node.id,
        offset: 0,
      };

      return true;
    }

    return false;
  }

  #handleTreeNodeNotFound(startContainer: Node) {
    if (!this.#trySelectOnParent(startContainer)) {
      this.state.cursorState = null;
    }
  }

  #findBlockNodeContainer(node: Node): BlockElement | undefined {
    let ptr: Node | null = node;

    while (ptr) {
      const node = ptr._mgNode as BlockElement | undefined;
      if (node && isUpperCase(node.nodeName)) {
        return node;
      }

      ptr = ptr.parentNode;
    }

    return;
  }

  #findTextOffsetInBlock(
    blockNode: BlockElement,
    focusedNode: Node,
    offsetInNode: number
  ): number {
    const block = this.state.blocks.get(blockNode.id);
    if (!block) {
      throw new Error("block id not found: " + blockNode.id);
    }

    return block.findTextOffsetInBlock?.(focusedNode, offsetInNode) ?? 0;
  }

  #selectionChanged = () => {
    const sel = window.getSelection();
    if (!sel) {
      return;
    }

    if (this.composing) {
      return;
    }

    if (sel.rangeCount === 0) {
      return;
    }

    const range = sel.getRangeAt(0);
    const { startContainer, endContainer, startOffset, endOffset } = range;

    // not a dom in this editor, ignore it.
    if (!isContainNode(startContainer, this.#container)) {
      this.state.cursorState = null;
      return;
    }

    const startNode = this.#findBlockNodeContainer(startContainer);
    if (!startNode) {
      this.#handleTreeNodeNotFound(startContainer);
      return;
    }

    const absoluteStartOffset = this.#findTextOffsetInBlock(
      startNode,
      startContainer,
      startOffset
    );

    if (range.collapsed) {
      const newCursorState: CursorState = {
        type: "collapsed",
        targetId: startNode.id,
        offset: absoluteStartOffset,
      };
      if (!areEqualShallow(newCursorState, this.state.cursorState)) {
        this.state.cursorState = {
          type: "collapsed",
          targetId: startNode.id,
          offset: absoluteStartOffset,
        };
      }
    } else {
      const endNode = this.#findBlockNodeContainer(endContainer);
      if (!endNode) {
        this.state.cursorState = null;
        return;
      }
      const absoluteEndOffset = this.#findTextOffsetInBlock(
        endNode,
        endContainer,
        endOffset
      );
      const newCursorState: CursorState = {
        type: "open",
        startId: startNode.id,
        startOffset: absoluteStartOffset,
        endId: endNode.id,
        endOffset: absoluteEndOffset,
      };
      if (!areEqualShallow(newCursorState, this.state.cursorState)) {
        this.state.cursorState = {
          type: "open",
          startId: startNode.id,
          startOffset: absoluteStartOffset,
          endId: endNode.id,
          endOffset: absoluteEndOffset,
        };
      }
    }

    const { toolbarDelegate } = this;

    if (toolbarDelegate.enabled) {
      if (this.#tryPlaceToolbar(range)) {
        toolbarDelegate.show();
      } else {
        toolbarDelegate.hide();
      }
    }
  };

  #tryPlaceToolbar(range: Range): boolean {
    const { cursorState } = this.state;
    if (!cursorState) {
      return false;
    }

    if (cursorState.type === "collapsed") {
      return false;
    }

    const { startId, endId } = cursorState;
    if (startId !== endId) {
      return false;
    }

    const containerRect = this.#container.getBoundingClientRect();
    // Do NOT call getBoundingClientRect, we need the first rect
    // not the rect of all ranges.
    const rect = range.getClientRects()[0];
    if (!rect) {
      return false;
    }

    const x = rect.x - containerRect.x;
    const y = rect.y - containerRect.y - rect.height - 12;

    this.toolbarDelegate.setPosition(x, y);

    return true;
  }

  #checkMarkedDom(changeset: Changeset, node: Node, currentOffset?: number) {
    const treeNode = node._mgNode as BlockElement;
    if (!node.parentNode) {
      // dom has been removed

      this.destructBlockNode(node);

      const parent = treeNode.parent as BlockyElement | undefined;
      if (parent) {
        changeset.removeChild(parent, treeNode);
      }
      return;
    }

    this.#checkBlockContent(changeset, node, treeNode, currentOffset);
  }

  /**
   * Check if there is new span created by the browser
   */
  #checkBlockContent(
    changeset: Changeset,
    node: Node,
    blockNode: BlockElement,
    currentOffset?: number
  ) {
    const block = this.state.blocks.get(blockNode.id);

    block?.blockContentChanged?.({
      changeset,
      node: node as HTMLDivElement,
      blockElement: blockNode,
      offset: currentOffset,
    });
  }

  #checkNodesChanged() {
    const doms = this.state.domMap.values();
    const changeset = new Changeset(this.state);
    for (const dom of doms) {
      this.#checkMarkedDom(changeset, dom, undefined);
    }
    changeset.apply({
      updateView: false,
    });
  }

  #handleOpenCursorContentChanged() {
    this.#checkNodesChanged();
    this.render();
  }

  #handleContentChanged = () => {
    const { cursorState } = this.state;
    if (cursorState === null || cursorState.type === "open") {
      this.#handleOpenCursorContentChanged();
      return;
    }

    const { targetId, offset: currentOffset } = cursorState;

    const domNode = this.state.domMap.get(targetId);
    if (!domNode) {
      console.warn(`id of block doesn't exist: ${targetId}`);
      return;
    }

    const change = new Changeset(this.state);
    this.#checkMarkedDom(change, domNode, currentOffset);
    change.apply({
      updateView: false,
    });
    // this is essential because the cursor will change
    // after the user typing.
    this.#selectionChanged();
    this.#debouncedSealUndo();
  };

  placeBannerAt(blockContainer: HTMLElement, node: BlockElement) {
    const block = this.state.blocks.get(node.id);
    if (!block) {
      return;
    }

    let { x, y } = this.#getRelativeOffsetByDom(blockContainer);

    x = this.bannerXOffset;

    const offset = block.getBannerOffset();
    x += offset.x;
    y += offset.y;

    this.bannerDelegate.focusedNode = node;
    this.bannerDelegate.show();
    this.bannerDelegate.setPosition(x, y);
  }

  /**
   * Remove node and call the destructor
   */
  destructBlockNode(node: Node) {
    if (node._mgNode) {
      const treeNode = node._mgNode as BlockElement;

      const block = this.state.blocks.get(treeNode.id);
      block?.dispose();
      this.state.blocks.delete(treeNode.id);

      this.state.domMap.delete(treeNode.id);
    }

    // TODO: call destructor
    removeNode(node);
  }

  /**
   * Get the element's relative position to the container of the editor.
   */
  #getRelativeOffsetByDom(element: HTMLElement): Position {
    const containerRect = this.#container.getBoundingClientRect();
    const blockRect = element.getBoundingClientRect();
    return {
      x: blockRect.x - containerRect.x,
      y: blockRect.y - containerRect.y,
    };
  }

  #hideBanner = () => {
    this.bannerDelegate.hide();
  };

  #handleCompositionStart = () => {
    this.composing = true;
    this.state.undoManager.cursorBeforeComposition = this.state.cursorState;
  };

  #handleCompositionEnd = () => {
    this.composing = false;
    this.#handleContentChanged();
    this.state.undoManager.cursorBeforeComposition = null;
  };

  #handleKeyDown = (e: KeyboardEvent) => {
    this.keyDown.emit(e);
    if (e.defaultPrevented) {
      return;
    }

    if (e.key === "Tab") {
      this.#handleKeyTab(e);
      return;
    }

    if (arrowKeys.has(e.key)) {
      return;
    }

    if (this.composing) {
      return;
    }

    if (e.key === "Enter") {
      if (!e.defaultPrevented) {
        e.preventDefault();
        this.#commitNewLine();
      }
    } else if (e.key === "Backspace") {
      this.#handleBackspace(e);
    } else if (e.key === "Delete") {
      this.#handleDelete(e);
    } else if (isHotkey("mod+z", e)) {
      e.preventDefault();
      this.state.undoManager.undo();
    } else if (isHotkey("mod+shift+z", e)) {
      e.preventDefault();
      this.state.undoManager.redo();
    }
  };

  #handleKeyTab(e: KeyboardEvent) {
    e.preventDefault();
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.type === "open") {
      return;
    }
    const block = this.state.blocks.get(cursorState.targetId);
    if (!block) {
      return;
    }

    if (e.shiftKey) {
      block.onDedent?.(e);
    } else {
      block.onIndent?.(e);
    }
  }

  #insertEmptyTextAfterBlock(parent: BlockyElement, afterId: string) {
    const newTextElement = this.state.createTextElement();
    const currentBlock = this.state.idMap.get(afterId);

    new Changeset(this.state)
      .insertChildrenAfter(parent, [newTextElement], currentBlock)
      .setCursorState({
        type: "collapsed",
        targetId: newTextElement.id,
        offset: 0,
      })
      .apply();
  }

  #commitNewLine() {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.type === "collapsed") {
      const blockElement = this.state.idMap.get(cursorState.targetId) as
        | BlockElement
        | undefined;
      if (!blockElement) {
        return;
      }

      if (blockElement.nodeName !== TextBlockName) {
        // default behavior
        this.#insertEmptyTextAfterBlock(
          blockElement.parent! as BlockyElement,
          cursorState.targetId
        );
        return;
      }
      const textModel = blockElement.firstChild! as BlockyTextModel;

      const cursorOffset = cursorState.offset;

      const slices = textModel.delta.slice(cursorOffset);

      const textType = getTextTypeForTextBlock(blockElement);
      const attributes = Object.create(null);
      if (this.preservedTextType.has(textType)) {
        // preserved data type
        attributes.textType = textType;
      }

      const newTextElement = this.state.createTextElement(attributes);
      const newTextModel = newTextElement.firstChild! as BlockyTextModel;

      const parentElement = blockElement.parent! as BlockyElement;
      new Changeset(this.state)
        .insertChildrenAfter(parentElement, [newTextElement], blockElement)
        .textConcat(newTextModel, () => slices)
        .textEdit(textModel, () =>
          new Delta()
            .retain(cursorOffset)
            .delete(textModel.length - cursorOffset)
        )
        .setCursorState({
          type: "collapsed",
          targetId: newTextElement.id,
          offset: 0,
        })
        .apply();
    } else {
      console.error("unhandled");
    }
  }

  #debouncedSealUndo = debounce(() => {
    this.state.undoManager.seal();
  }, 1000);

  #handleBeforeChangesetApply = (changeset: FinalizedChangeset) => {
    const { afterCursor, options } = changeset;
    if (!isUndefined(afterCursor) || options.refreshCursor) {
      this.state.cursorState = null;
    }
  };

  #handleChangesetApplied = (changeset: FinalizedChangeset) => {
    const { options } = changeset;
    if (options.updateView) {
      this.render(() => {
        if (!isUndefined(changeset.afterCursor)) {
          this.state.cursorState = changeset.afterCursor;
        } else if (options.refreshCursor) {
          this.state.cursorState = changeset.beforeCursor;
        }
      });
    }

    if (options.recordUndo) {
      const undoItem = this.state.undoManager.getAUndoItem();
      undoItem.push(...changeset.operations);
      this.#debouncedSealUndo();
    }
  };

  openExternalLink(link: string) {
    // TODO: handle this in plugin
    window.open(link, "_blank")?.focus();
  }

  #handleDelete(e: KeyboardEvent) {
    if (this.#deleteBlockOnFocusedCursor()) {
      e.preventDefault();
    }
  }

  #handleBackspace(e: KeyboardEvent) {
    if (this.#tryMergeTextToPreviousLine()) {
      e.preventDefault();
      return;
    }
    if (this.#deleteBlockOnFocusedCursor()) {
      e.preventDefault();
    }
  }

  /**
   * If the focusing line is TextLine,
   * try to merge to previous line.
   *
   * If the previous lins is not a text line,
   * then focus on it.
   */
  #tryMergeTextToPreviousLine(): boolean {
    const { cursorState } = this.state;
    if (!cursorState) {
      return false;
    }
    if (cursorState.type === "open") {
      return false;
    }

    const { targetId, offset } = cursorState;

    if (offset !== 0) {
      return false;
    }

    const node = this.state.idMap.get(targetId) as BlockElement | undefined;
    if (!node) {
      return false;
    }

    if (node.nodeName !== TextBlockName) {
      return false;
    }

    const prevNode = node.prevSibling as BlockElement | undefined;
    if (!prevNode) {
      return true;
    }

    if (prevNode.nodeName !== TextBlockName) {
      this.state.cursorState = {
        type: "collapsed",
        targetId: prevNode.id,
        offset: 0,
      };
      return true;
    }
    const firstChild = prevNode.firstChild;
    if (!firstChild || !(firstChild instanceof BlockyTextModel)) {
      return true;
    }
    if (!node.firstChild) {
      return true;
    }

    const thisTextModel = node.firstChild as BlockyTextModel;
    const prevTextModel = firstChild as BlockyTextModel;
    const originalLength = prevTextModel.length;

    new Changeset(this.state)
      .textConcat(prevTextModel, () => thisTextModel.delta)
      .removeChild(node.parent as BlockyElement, node)
      .setCursorState({
        type: "collapsed",
        targetId: prevNode.id,
        offset: originalLength,
      })
      .apply();

    return true;
  }

  #getBlockElementAtCollapsedCursor(): BlockElement | undefined {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.type === "open") {
      return;
    }

    const { targetId } = cursorState;

    return this.state.idMap.get(targetId) as BlockElement | undefined;
  }

  #deleteBlockOnFocusedCursor(): boolean {
    const node = this.#getBlockElementAtCollapsedCursor();
    if (!node) {
      return false;
    }
    const prevNode = node.prevSibling as BlockElement;

    const blockDef = this.registry.block.getBlockDefByName(node.nodeName)!;

    if (blockDef.editable !== false) {
      return false;
    }

    const changeset = new Changeset(this.state);
    const parent = node.parent as BlockyElement | undefined;

    if (parent) {
      changeset.removeChild(parent, node).apply();
    }

    if (prevNode) {
      changeset.setCursorState({
        type: "collapsed",
        targetId: prevNode.id,
        offset: 0,
      });
      this.#focusEndOfNode(changeset, prevNode);
    } else {
      changeset.setCursorState(null);
    }

    changeset.apply();

    return true;
  }

  #focusEndOfNode(changeset: Changeset, node: BlockElement) {
    if (node.nodeName === TextBlockName) {
      const textModel = node.firstChild! as BlockyTextModel;
      changeset.setCursorState({
        type: "collapsed",
        targetId: node.id,
        offset: textModel.length,
      });
    } else {
      changeset.setCursorState({
        type: "collapsed",
        targetId: node.id,
        offset: 0,
      });
    }
  }

  handleCursorStateChanged = (
    newState: CursorState | undefined,
    oldState: CursorState | undefined
  ) => {
    if (areEqualShallow(newState, oldState)) {
      return;
    }

    const sel = window.getSelection();
    if (!sel) {
      return;
    }

    // if selecting range is in the editor, erase it
    // otherwise, ignore it.
    if (!newState) {
      if (sel.rangeCount === 0) {
        return;
      }
      const range = sel.getRangeAt(0);
      const startContainer = range.startContainer;
      if (isContainNode(startContainer, this.#container)) {
        sel.removeAllRanges();
      }
      return;
    }

    if (newState.type === "open") {
      this.#focusOnOpenCursor(newState, sel);
      return;
    }

    this.#focusOnCollapsedCursor(newState, sel);
  };

  #focusOnCollapsedCursor(collapsedCursor: CollapsedCursor, sel: Selection) {
    const { targetId } = collapsedCursor;

    const targetNode = this.state.domMap.get(targetId);
    if (!targetNode) {
      throw new Error(`dom not found: ${targetId}`);
    }

    if (
      targetNode instanceof HTMLDivElement &&
      targetNode.classList.contains(this.#renderer.blockClassName)
    ) {
      if (targetNode.nodeName !== TextBlockName) {
        sel.removeAllRanges();
      }
      this.#focusBlock(sel, targetNode, collapsedCursor);
    } else {
      console.error("unknown element:", targetNode);
    }
  }

  #focusOnOpenCursor(openCursor: OpenCursorState, sel: Selection) {
    const { startId, startOffset, endId, endOffset } = openCursor;

    const startBlock = this.state.blocks.get(startId);
    if (!startBlock) {
      return;
    }

    const endBlock = this.state.blocks.get(endId);
    if (!endBlock) {
      return;
    }

    const startCursorDom = startBlock.getCursorDomByOffset?.(startOffset);

    if (!startCursorDom) {
      return;
    }

    const endCursorDom = endBlock.getCursorDomByOffset?.(endOffset);

    if (!endCursorDom) {
      return;
    }

    const range = document.createRange();
    range.setStart(startCursorDom.node, startCursorDom.offset);
    range.setEnd(endCursorDom.node, endCursorDom.offset);

    sel.addRange(range);
  }

  /**
   * It's hard to define the behavior of focusing on a block.
   *
   * If it's a text block try to focus on the text.
   * Otherwise, focus on the outline?
   */
  #focusBlock(
    sel: Selection,
    blockDom: HTMLDivElement,
    cursor: CollapsedCursor
  ) {
    const node = blockDom._mgNode as BlockElement | undefined;
    if (!node) {
      return;
    }

    this.#blurBlock();

    this.#lastFocusedId = node.id;
    const block = this.state.blocks.get(node.id)!;
    block.blockFocused?.({ node: blockDom, cursor, selection: sel });
  }

  #blurBlock() {
    if (!this.#lastFocusedId) {
      return;
    }
    const block = this.state.blocks.get(this.#lastFocusedId)!;
    if (!block) {
      this.#lastFocusedId = undefined;
      return;
    }

    const dom = this.state.domMap.get(this.#lastFocusedId);
    const sel = window.getSelection()!;
    if (dom) {
      block.blockBlur?.({
        node: dom as HTMLDivElement,
        cursor: this.state.cursorState,
        selection: sel,
      });
    }

    this.#lastFocusedId = undefined;
  }

  #handlePaste = (e: ClipboardEvent) => {
    e.preventDefault(); // take over the paste event

    const { clipboardData } = e;

    if (!clipboardData) {
      return;
    }

    const types = e.clipboardData?.types;
    if (!types) {
      return;
    }

    const htmlData = clipboardData.getData(MineType.Html);
    if (htmlData) {
      this.pasteHTMLAtCursor(htmlData);
      return;
    }

    const plainText = clipboardData.getData(MineType.PlainText);
    if (plainText) {
      this.#pastePlainTextOnCursor(plainText);
      return;
    }
  };

  /**
   * Use the API provided by the browser to parse the html for the bundle size.
   * Maybe use an external library is better for unit tests. But it will increase
   * the size of the bundles.
   */
  pasteHTMLAtCursor(html: string) {
    try {
      const blocks = this.#htmlConverter.parseFromString(html);
      this.#pasteElementsAtCursor(blocks);
    } catch (e) {
      console.error(e);
    }
  }

  #pasteElementsAtCursor(elements: BlockElement[]) {
    if (elements.length === 0) {
      return;
    }
    const currentBlockElement = this.#getBlockElementAtCollapsedCursor();
    if (!currentBlockElement) {
      return;
    }
    const parent = currentBlockElement.parent! as BlockyElement;
    const prev = currentBlockElement;

    const changeset = new Changeset(this.state);
    const insertChildren: BlockyNode[] = [];
    for (let i = 0, len = elements.length; i < len; i++) {
      const element = elements[i];

      if (
        i === 0 &&
        currentBlockElement.nodeName === TextBlockName &&
        element.nodeName === TextBlockName
      ) {
        const prevTextModel =
          currentBlockElement.firstChild! as BlockyTextModel;
        const firstTextModel = element.firstChild! as BlockyTextModel;
        if (!prevTextModel || !firstTextModel) {
          continue;
        }
        changeset.textConcat(prevTextModel, () => firstTextModel.delta);
        // first item, try to merge text
        continue;
      }
      insertChildren.push(element);
    }
    changeset.insertChildrenAfter(parent, insertChildren, prev);
    changeset.apply();
  }

  /**
   * Calculate the attributes from the dom.
   * It's used for pasting text, and to recognize the dom created by the browser.
   */
  getAttributesBySpan(span: HTMLElement): AttributesObject {
    const spanRegistry = this.registry.span;
    const attributes: AttributesObject = {};
    const href = span.getAttribute("data-href");
    if (href) {
      attributes["href"] = href;
    } else if (span instanceof HTMLAnchorElement) {
      attributes["href"] = span.getAttribute("href");
    }

    for (const cls of span.classList) {
      const style = spanRegistry.classnames.get(cls);
      if (style) {
        attributes[style.name] = true;
      }
    }

    return attributes;
  }

  #pastePlainTextOnCursor(text: string) {
    const cursor = this.#insertTextAt(this.state.cursorState, text);
    this.render(() => {
      this.state.cursorState = cursor;
    });
  }

  #insertTextAt(
    cursorState: CursorState | null,
    text: string,
    attributes?: AttributesObject
  ): CursorState | null {
    if (!cursorState) {
      return null;
    }

    if (cursorState.type === "open") {
      return null;
    }

    const textElement = this.getTextElementByBlockId(cursorState.targetId);
    if (!textElement) {
      return null;
    }

    const afterOffset = cursorState.offset + text.length;
    const textModel = textElement.firstChild! as BlockyTextModel;
    new Changeset(this.state)
      .textEdit(textModel, () =>
        new Delta().retain(cursorState.offset).insert(text, attributes)
      )
      .apply();
    return {
      type: "collapsed",
      targetId: cursorState.targetId,
      offset: afterOffset,
    };
  }

  getTextElementByBlockId(blockId: string): BlockElement | undefined {
    const treeNode = this.state.idMap.get(blockId) as BlockElement | undefined;
    if (!treeNode) {
      return;
    }

    if (treeNode.nodeName === TextBlockName) {
      return treeNode;
    }
  }

  dispose() {
    document.removeEventListener("selectionchange", this.#selectionChanged);
    flattenDisposable(this.disposables).dispose();
  }
}
