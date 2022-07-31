import { $on, isContainNode, removeNode } from "blocky-common/es/dom";
import { isUpperCase } from "blocky-common/es/character";
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
import { DocRenderer } from "@pkg/view/renderer";
import {
  type AttributesObject,
  State as DocumentState,
  TextType,
  BlockyTextModel,
  BlockyElement,
  Changeset,
  BlockElement,
  BlockyNode,
} from "@pkg/model";
import { CursorState } from "@pkg/model/cursor";
import {
  symSetCursorState,
  CursorStateUpdateReason,
  type CursorStateUpdateEvent,
} from "@pkg/model/state";
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
import { UndoManager } from "@pkg/model/undoManager";
import { EditorController } from "./controller";
import { type FollowerWidget } from "./followerWidget";
import { Block } from "@pkg/block/basic";
import { getTextTypeForTextBlock } from "@pkg/block/textBlock";
import {
  CollaborativeCursorManager,
  type CollaborativeCursorFactory,
} from "./collaborativeCursors";
import { isHotkey } from "is-hotkey";
import { ChangesetRecordOption, FinalizedChangeset } from "@pkg/model/change";

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
  collaborativeCursorFactory?: CollaborativeCursorFactory;
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

export class TextInputEvent {
  constructor(
    readonly beforeDelta: Delta,
    readonly applyDelta: Delta,
    readonly blockElement: BlockElement
  ) {}
}

/**
 * The internal view layer object of the editor.
 * It's not recommended to manipulate this class by the user.
 * The user should use {@link EditorController} to manipulate the editor.
 *
 * This class is designed to used internally. This class can be
 * used by the plugins to do something internally.
 */
export class Editor {
  #container: HTMLDivElement;
  #renderedDom: HTMLDivElement | undefined;
  #renderer: DocRenderer;
  #lastFocusedId: string | undefined;
  #followerWidget: FollowerWidget | undefined;

  readonly onEveryBlock: Slot<Block> = new Slot();

  readonly bannerDelegate: BannerDelegate;
  readonly toolbarDelegate: ToolbarDelegate;
  idGenerator: IdGenerator;

  readonly anchorSpanClass: string = "blocky-text-anchor";
  readonly undoManager: UndoManager;

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
      collaborativeCursorFactory:
        controller.options?.collaborativeCursorFactory,
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
      collaborativeCursorFactory,
    } = options;
    this.state = state;
    this.registry = registry;
    this.#container = container;
    this.idGenerator = idGenerator ?? makeDefaultIdGenerator();

    this.padding = {
      ...makeDefaultPadding(),
      ...padding,
    };
    this.bannerXOffset = bannerXOffset ?? 24;

    this.collaborativeCursorManager = new CollaborativeCursorManager(
      collaborativeCursorFactory
    );
    this.collaborativeCursorManager.mount(this.#container);

    this.bannerDelegate = new BannerDelegate(controller, bannerFactory);
    this.bannerDelegate.mount(this.#container);
    this.disposables.push(this.bannerDelegate);

    this.toolbarDelegate = new ToolbarDelegate(controller, toolbarFactory);
    this.toolbarDelegate.mount(this.#container);
    this.disposables.push(this.toolbarDelegate);

    document.addEventListener("selectionchange", this.#selectionChangedHandler);

    state.cursorStateChanged.on(this.handleCursorStateChanged);

    this.disposables.push($on(container, "mouseleave", this.#hideBanner));

    this.registry.plugin.emitInitPlugins(this);

    this.#renderer = new DocRenderer({
      clsPrefix: "blocky",
      editor: this,
    });

    this.#initBlockCreated();

    this.state.beforeChangesetApply.on(this.#handleBeforeChangesetApply);
    this.state.changesetApplied.on(this.#handleChangesetApplied);

    this.undoManager = new UndoManager(state);
  }

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

  drawCollaborativeCursor(id: string, state: CursorState | null) {
    setTimeout(() => {
      if (!state) {
        this.collaborativeCursorManager.deleteById(id);
        return;
      }
      const cursor = this.collaborativeCursorManager.getOrInit(id);

      const containerRect = this.#container.getBoundingClientRect();
      if (state.isCollapsed) {
        const blockId = state.id;
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
      $on(newDom, "copy", this.#handleCopy);
      $on(newDom, "paste", this.#handlePaste);
      $on(newDom, "blur", this.#handleEditorBlur);

      this.#renderedDom = newDom;
    }

    if (done) {
      done();
    } else {
      this.#handleSelectionChanged(CursorStateUpdateReason.contentChanged);
    }

    this.controller.emitNextTicks();
  }

  #handleEditorBlur = () => {
    this.#handleSelectionChanged(CursorStateUpdateReason.uiEvent);
  };

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

      this.state[symSetCursorState](
        CursorState.collapse(node.id, 0),
        CursorStateUpdateReason.changeset
      );

      return true;
    }

    return false;
  }

  #handleTreeNodeNotFound(startContainer: Node) {
    if (!this.#trySelectOnParent(startContainer)) {
      this.state[symSetCursorState](null, CursorStateUpdateReason.changeset);
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

    return (
      block.findTextOffsetInBlock?.(focusedNode, offsetInNode) ?? offsetInNode
    );
  }

  #selectionChangedHandler = () => {
    this.#handleSelectionChanged(CursorStateUpdateReason.uiEvent);
  };

  #handleSelectionChanged(reason: CursorStateUpdateReason) {
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

    if (!isContainNode(startContainer, this.#container)) {
      this.state[symSetCursorState](null, reason);
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
      const newCursorState = CursorState.collapse(
        startNode.id,
        absoluteStartOffset
      );
      if (!areEqualShallow(newCursorState, this.state.cursorState)) {
        this.state[symSetCursorState](
          CursorState.collapse(startNode.id, absoluteStartOffset),
          reason
        );
      }

      this.#showToolbarByCursorState(newCursorState, range);
      return;
    }

    const endNode = this.#findBlockNodeContainer(endContainer);
    if (!endNode) {
      this.state[symSetCursorState](null, reason);
      return;
    }
    const absoluteEndOffset = this.#findTextOffsetInBlock(
      endNode,
      endContainer,
      endOffset
    );
    const newCursorState = new CursorState(
      startNode.id,
      absoluteStartOffset,
      endNode.id,
      absoluteEndOffset
    );
    if (!areEqualShallow(newCursorState, this.state.cursorState)) {
      this.state[symSetCursorState](
        new CursorState(
          startNode.id,
          absoluteStartOffset,
          endNode.id,
          absoluteEndOffset
        ),
        reason
      );
    }

    this.#showToolbarByCursorState(newCursorState, range);

    if (this.#followerWidget) {
      this.#followerWidget.dispose();
      this.#followerWidget = undefined;
    }
  }

  #showToolbarByCursorState(newCursorState: CursorState, range: Range) {
    if (this.toolbarDelegate.enabled) {
      if (newCursorState.startId !== "Title" && this.#tryPlaceToolbar(range)) {
        this.toolbarDelegate.show();
      } else {
        this.toolbarDelegate.hide();
      }
    }
  }

  #tryPlaceToolbar(range: Range): boolean {
    const { cursorState } = this.state;
    if (!cursorState) {
      return false;
    }

    if (cursorState.isCollapsed) {
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

      const parent = treeNode.parent;
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

  /**
   * Call the #checkNodesChanged to apply
   * changes to the model.
   *
   * But there will be inconsistent between
   * the model and the DOM. So we need to rerender again.
   *
   * But directly call the render() method will make the cursor
   * wrong. So we need to read the cursor from the browser and store it.
   *
   * Before we call the update method, we need to clear the selection
   * to prevent the browser make the cursor jumping around.
   */
  #handleOpenCursorContentChanged() {
    this.#checkNodesChanged();
    this.#handleSelectionChanged(CursorStateUpdateReason.contentChanged);
    const storedCursorState = this.state.cursorState;
    this.state[symSetCursorState](null, CursorStateUpdateReason.changeset);
    this.render(() => {
      this.state[symSetCursorState](
        storedCursorState,
        CursorStateUpdateReason.changeset
      );
    });
  }

  #handleContentChanged = () => {
    const { cursorState } = this.state;
    if (cursorState === null || cursorState.isOpen) {
      this.#handleOpenCursorContentChanged();
      return;
    }

    const { id, offset: currentOffset } = cursorState;

    const domNode = this.state.domMap.get(id);
    if (!domNode) {
      console.warn(`id of block doesn't exist: ${id}`);
      return;
    }

    const change = new Changeset(this.state);
    this.#checkMarkedDom(change, domNode, currentOffset);
    change.apply({
      updateView: false,
    });
    // this is essential because the cursor will change
    // after the user typing.
    this.#handleSelectionChanged(CursorStateUpdateReason.contentChanged);
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
    this.undoManager.cursorBeforeComposition = this.state.cursorState;
  };

  #handleCompositionEnd = () => {
    this.composing = false;
    this.#handleContentChanged();
    this.undoManager.cursorBeforeComposition = null;
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
      this.undoManager.undo();
    } else if (isHotkey("mod+shift+z", e)) {
      e.preventDefault();
      this.undoManager.redo();
    }
  };

  #handleKeyTab(e: KeyboardEvent) {
    e.preventDefault();
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.isOpen) {
      return;
    }
    const block = this.state.blocks.get(cursorState.id);
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
    const currentBlock = this.state.getBlockElementById(afterId);

    new Changeset(this.state)
      .insertChildrenAfter(parent, [newTextElement], currentBlock)
      .setCursorState(CursorState.collapse(newTextElement.id, 0))
      .apply();
  }

  #commitNewLine() {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.isCollapsed) {
      const blockElement = this.state.getBlockElementById(cursorState.id);
      if (!blockElement) {
        return;
      }

      if (blockElement.nodeName !== TextBlockName) {
        // default behavior
        this.#insertEmptyTextAfterBlock(
          blockElement.parent! as BlockyElement,
          cursorState.id
        );
        return;
      }
      const textModel = blockElement.getAttribute(
        "textContent"
      ) as BlockyTextModel;

      const cursorOffset = cursorState.offset;

      const slices = textModel.delta.slice(cursorOffset);

      const textType = getTextTypeForTextBlock(blockElement);
      const attributes = Object.create(null);
      if (this.preservedTextType.has(textType)) {
        // preserved data type
        attributes.textType = textType;
      }

      const children: BlockyNode[] = [];
      let ptr = blockElement.firstChild;
      while (ptr) {
        children.push(ptr.clone());
        ptr = ptr.nextSibling;
      }
      const newTextElement = this.state.createTextElement(
        slices,
        attributes,
        children
      );

      const parentElement = blockElement.parent! as BlockyElement;
      new Changeset(this.state)
        .deleteChildrenAt(blockElement, 0, children.length)
        .insertChildrenAfter(parentElement, [newTextElement], blockElement)
        .textEdit(blockElement, "textContent", () =>
          new Delta()
            .retain(cursorOffset)
            .delete(textModel.length - cursorOffset)
        )
        .setCursorState(CursorState.collapse(newTextElement.id, 0))
        .apply();
    } else {
      console.error("unhandled");
    }
  }

  #debouncedSealUndo = debounce(() => {
    this.undoManager.seal();
  }, 1000);

  #handleBeforeChangesetApply = (changeset: FinalizedChangeset) => {
    const { afterCursor, options } = changeset;
    if (!isUndefined(afterCursor) || options.refreshCursor) {
      this.state[symSetCursorState](null, CursorStateUpdateReason.changeset);
    }
  };

  #handleChangesetApplied = (changeset: FinalizedChangeset) => {
    const { options } = changeset;
    const isThisUser = changeset.userId === this.controller.userId;
    if (options.updateView || changeset.forceUpdate) {
      this.render(() => {
        if (!isThisUser) {
          return;
        }
        if (!isUndefined(changeset.afterCursor)) {
          this.state[symSetCursorState](
            changeset.afterCursor,
            CursorStateUpdateReason.changeset
          );
        } else if (options.refreshCursor) {
          this.state[symSetCursorState](
            changeset.beforeCursor,
            CursorStateUpdateReason.changeset
          );
        }
      });
    }

    if (options.record === ChangesetRecordOption.Undo && isThisUser) {
      const undoItem = this.undoManager.getAUndoItem();
      if (undoItem.startVersion < 0) {
        undoItem.startVersion = changeset.version;
        undoItem.length = 1;
      } else {
        undoItem.length = 1 + (changeset.version - undoItem.startVersion);
      }
      this.undoManager.clearRedoStack();
      this.#debouncedSealUndo();
    } else if (options.record === ChangesetRecordOption.Redo && isThisUser) {
      this.undoManager.pushRedoItem(changeset);
    } else {
      // applying changeset from another user
      this.undoManager.seal();
    }
  };

  openExternalLink(link: string) {
    // TODO: handle this in plugin
    window.open(link, "_blank")?.focus();
  }

  initFirstEmptyBlock() {
    if (this.state.document.body.firstChild) {
      return;
    }
    const empty = this.state.createTextElement();
    new Changeset(this.state)
      .insertChildrenAt(this.state.document.body, 0, [empty])
      .apply({
        record: ChangesetRecordOption.None,
      });
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
   * Technically, prevSibling is not the previous element.
   * The answer is the bottom most element.
   */
  #findPreviousElement(node: BlockElement): BlockElement | undefined {
    let ptr = node.prevSibling as BlockElement | undefined;
    if (!ptr) {
      return ptr;
    }
    while (ptr.lastChild) {
      ptr = ptr!.lastChild as BlockElement;
    }
    return ptr;
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
    if (cursorState.isOpen) {
      return false;
    }

    const { id, offset } = cursorState;

    if (offset !== 0) {
      return false;
    }

    const node = this.state.getBlockElementById(id);
    if (!node) {
      return false;
    }

    if (node.nodeName !== TextBlockName) {
      return false;
    }

    const prevNode = this.#findPreviousElement(node);
    if (!prevNode) {
      return true;
    }

    if (prevNode.nodeName !== TextBlockName) {
      this.state[symSetCursorState](
        CursorState.collapse(prevNode.id, 0),
        CursorStateUpdateReason.changeset
      );
      return true;
    }

    const thisTextModel = node.getAttribute<BlockyTextModel>("textContent")!;
    const prevTextModel =
      prevNode.getAttribute<BlockyTextModel>("textContent")!;
    const originalLength = prevTextModel.length;

    new Changeset(this.state)
      .textConcat(prevNode, "textContent", () => thisTextModel.delta)
      .removeChild(node.parent!, node)
      .setCursorState(CursorState.collapse(prevNode.id, originalLength))
      .apply();

    return true;
  }

  #getBlockElementAtCollapsedCursor(): BlockElement | undefined {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.isOpen) {
      return;
    }

    return this.state.getBlockElementById(cursorState.id);
  }

  #deleteBlockOnFocusedCursor(): boolean {
    const node = this.#getBlockElementAtCollapsedCursor();
    if (!node) {
      return false;
    }
    const prevNode = this.#findPreviousElement(node);

    const blockDef = this.registry.block.getBlockDefByName(node.nodeName)!;

    if (blockDef.editable !== false) {
      return false;
    }

    const changeset = new Changeset(this.state);
    const parent = node.parent;

    if (parent) {
      changeset.removeChild(parent, node).apply();
    }

    if (prevNode) {
      changeset.setCursorState(CursorState.collapse(prevNode.id, 0));
      this.#focusEndOfNode(changeset, prevNode);
    } else {
      changeset.setCursorState(null);
    }

    changeset.apply();

    return true;
  }

  #focusEndOfNode(changeset: Changeset, node: BlockElement) {
    if (node.nodeName === TextBlockName) {
      const textModel = node.getAttribute<BlockyTextModel>("textContent")!;
      changeset.setCursorState(CursorState.collapse(node.id, textModel.length));
    } else {
      changeset.setCursorState(CursorState.collapse(node.id, 0));
    }
  }

  handleCursorStateChanged = (evt: CursorStateUpdateEvent) => {
    if (
      evt.reason === CursorStateUpdateReason.contentChanged ||
      evt.reason === CursorStateUpdateReason.uiEvent
    ) {
      return;
    }

    const newState = evt.state;
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

    if (newState.isOpen) {
      this.#focusOnOpenCursor(newState, sel);
      return;
    }

    this.#focusOnCollapsedCursor(newState, sel);
  };

  #focusOnCollapsedCursor(collapsedCursor: CursorState, sel: Selection) {
    const { id } = collapsedCursor;

    const targetNode = this.state.domMap.get(id);
    if (!targetNode) {
      throw new Error(`dom not found: ${id}`);
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

  #focusOnOpenCursor(openCursor: CursorState, sel: Selection) {
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
  #focusBlock(sel: Selection, blockDom: HTMLDivElement, cursor: CursorState) {
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

  #handleCopy = (e: ClipboardEvent) => {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }

    const blockElement = this.state.getBlockElementById(cursorState.id);
    if (!blockElement) {
      return;
    }

    if (
      blockElement.nodeName === TextBlockName ||
      blockElement.nodeName === "Title"
    ) {
      return;
    }

    const blockData = blockElement.toJSON();
    console.log(JSON.stringify(blockData).replace(/"/g, '\\"'));
    e.clipboardData?.clearData();
    e.clipboardData?.setData(
      "text/html",
      `<div data-id="${blockElement.id}" data-type="${
        blockElement.nodeName
      }" data-content="${JSON.stringify(blockData).replace(
        /"/g,
        "&quot;"
      )}"></div>`
    );
    e.preventDefault();
  };

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
      this.controller.pasteHTMLAtCursor(htmlData);
      return;
    }

    const plainText = clipboardData.getData(MineType.PlainText);
    if (plainText) {
      this.#pastePlainTextOnCursor(plainText);
      return;
    }
  };

  #pastePlainTextOnCursor(text: string) {
    this.#insertTextAt(this.state.cursorState, text);
  }

  #insertTextAt(
    cursorState: CursorState | null,
    text: string,
    attributes?: AttributesObject
  ) {
    if (!cursorState) {
      return null;
    }

    if (cursorState.isOpen) {
      return null;
    }

    const textElement = this.getTextElementByBlockId(cursorState.id);
    if (!textElement) {
      return null;
    }

    const afterOffset = cursorState.offset + text.length;
    new Changeset(this.state)
      .textEdit(textElement, "textContent", () =>
        new Delta().retain(cursorState.offset).insert(text, attributes)
      )
      .setCursorState(CursorState.collapse(cursorState.id, afterOffset))
      .apply();
  }

  getTextElementByBlockId(blockId: string): BlockElement | undefined {
    const treeNode = this.state.getBlockElementById(blockId);
    if (!treeNode) {
      return;
    }

    if (treeNode.nodeName === TextBlockName) {
      return treeNode;
    }
  }

  insertFollowerWidget(widget: FollowerWidget) {
    this.#followerWidget?.dispose();
    this.#followerWidget = widget;
    this.#container.insertBefore(widget.container, this.#container.firstChild);
    widget.startCursorState = this.state.cursorState!;
    widget.disposing.on(() => {
      this.#followerWidget = undefined;
    });
    widget.widgetMounted(this.controller);

    this.#placeFollowWidgetUnderCursor(widget);
  }

  #placeFollowWidgetUnderCursor(followWidget: FollowerWidget) {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    if (selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    const last = rects.item(rects.length - 1)!;
    let x = last.x;
    let y = last.y;

    const containerRect = this.#container.getBoundingClientRect();
    x -= containerRect.x;
    y -= containerRect.y;

    y += 20;

    followWidget.x = x;
    followWidget.y = y;
  }

  dispose() {
    this.#followerWidget?.dispose();
    this.#followerWidget = undefined;
    document.removeEventListener(
      "selectionchange",
      this.#selectionChangedHandler
    );
    flattenDisposable(this.disposables).dispose();
  }
}
