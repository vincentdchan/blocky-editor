import { isContainNode, removeNode, type Padding } from "blocky-common/es/dom";
import {
  isUpperCase,
  areEqualShallow,
  flattenDisposable,
  type IDisposable,
  type Position,
} from "blocky-common/es";
import { Subject, takeUntil, take, fromEvent, BehaviorSubject } from "rxjs";
import {
  debounce,
  isFunction,
  isUndefined,
  isString,
  isNumber,
} from "lodash-es";
import { DocRenderer, RenderFlag, RenderOption } from "@pkg/view/renderer";
import { EditorState, SearchContext, blockyDefaultFonts } from "@pkg/model";
import {
  type CursorStateUpdateEvent,
  BlockyTextModel,
  DataBaseElement,
  BlockDataElement,
  DataBaseNode,
  CursorState,
  ChangesetRecordOption,
  Changeset,
  FinalizedChangeset,
  CursorStateUpdateReason,
  TextType,
} from "@pkg/data";
import Delta from "quill-delta-es";
import {
  IPlugin,
  PluginRegistry,
  type AfterFn,
} from "@pkg/registry/pluginRegistry";
import { SpanRegistry } from "@pkg/registry/spanRegistry";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { textToDeltaWithURL } from "@pkg/helper/urlHelper";
import { SpannerDelegate, type SpannerFactory } from "./spannerDelegate";
import { ToolbarDelegate, type ToolbarFactory } from "./toolbarDelegate";
import { TextBlock } from "@pkg/block/textBlock";
import { EditorController } from "./controller";
import { type FollowerWidget } from "./followerWidget";
import { Block, ContentBlock } from "@pkg/block/basic";
import { getTextTypeForTextBlock } from "@pkg/block/textBlock";
import {
  CollaborativeCursorManager,
  type CollaborativeCursorFactory,
} from "./collaborativeCursors";
import { TitleBlock } from "@pkg/block/titleBlock";
import type { ThemeData } from "@pkg/model/theme";

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
  state: EditorState;
  registry: EditorRegistry;
  container: HTMLDivElement;
  idGenerator?: IdGenerator;
  spannerFactory?: SpannerFactory;
  toolbarFactory?: ToolbarFactory;
  padding?: Partial<Padding>;
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
  #beforeString: string | undefined;
  constructor(
    readonly beforeDelta: Delta,
    readonly applyDelta: Delta,
    readonly blockElement: BlockDataElement
  ) {}

  get beforeString(): string {
    if (isUndefined(this.#beforeString)) {
      this.#beforeString = this.beforeDelta.reduce((prev, item) => {
        if (typeof item.insert === "string") {
          return prev + item.insert;
        }
        return prev;
      }, "");
    }
    return this.#beforeString;
  }
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
  /**
   * Input events will be fired after the changeset applied.
   * So we need an array to store them.
   */
  #stagedInput: TextInputEvent[] = [];
  #themeData = new BehaviorSubject<ThemeData | undefined>(undefined);
  #searchContext: SearchContext | undefined;

  darggingNode: BlockDataElement | undefined;
  prevDragOverBlock: ContentBlock | null = null;

  readonly dispose$ = new Subject<void>();

  readonly onEveryBlock: Subject<Block> = new Subject();

  readonly spannerDelegate?: SpannerDelegate;
  readonly toolbarDelegate: ToolbarDelegate;
  idGenerator: IdGenerator;

  readonly anchorSpanClass: string = "blocky-text-anchor";

  readonly state: EditorState;
  readonly registry: EditorRegistry;

  /**
   * @deprecated The method should not be used
   */
  get keyDown() {
    return this.keyDown$;
  }

  /**
   * @deprecated The method should not be used
   */
  get textInput() {
    return this.textInput$;
  }

  readonly keyDown$ = new Subject<KeyboardEvent>();
  readonly textInput$ = new Subject<TextInputEvent>();
  readonly contentChanged$ = new Subject<void>();
  readonly compositionStart$ = new Subject<void>();
  readonly compositionEnd$ = new Subject<void>();

  readonly preservedTextType: Set<TextType> = new Set([
    TextType.Bulleted,
    TextType.Numbered,
  ]);

  readonly collaborativeCursorManager: CollaborativeCursorManager;

  readonly padding: Padding;

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
      spannerFactory: controller.options?.spannerFactory,
      toolbarFactory: controller.options?.toolbarFactory,
      padding: controller.options?.padding,
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
      spannerFactory: bannerFactory,
      toolbarFactory,
      padding,
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

    this.collaborativeCursorManager = new CollaborativeCursorManager(
      collaborativeCursorFactory
    );
    this.collaborativeCursorManager.mount(this.#container);

    if (bannerFactory) {
      this.spannerDelegate = new SpannerDelegate(controller, bannerFactory);
      this.spannerDelegate.mount(this.#container);
      this.disposables.push(this.spannerDelegate);
    }

    this.toolbarDelegate = new ToolbarDelegate({
      controller,
      factory: toolbarFactory,
    });
    this.toolbarDelegate.mount(this.#container);
    this.disposables.push(this.toolbarDelegate);

    document.addEventListener("selectionchange", this.#selectionChangedHandler);

    state.cursorStateChanged
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.handleCursorStateChanged);

    fromEvent(container, "mouseleave")
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.#hideSpanner);

    this.registry.plugin.initAllPlugins(this);

    this.#renderer = new DocRenderer({
      clsPrefix: "blocky",
      editor: this,
    });

    this.#initBlockCreated();

    this.state.beforeChangesetApply
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.#handleBeforeChangesetApply);
    this.state.changesetApplied
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.#handleChangesetApplied);
    this.state.changesetApplied2$
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.#handleChangesetApplied2);
    this.state.blockWillDelete
      .pipe(takeUntil(this.dispose$))
      .subscribe((blockElement: BlockDataElement) => {
        const dom = this.state.domMap.get(blockElement.id);
        if (dom) {
          this.destructBlockNode(dom);
        }
      });
  }

  get themeData(): ThemeData | undefined {
    return this.#themeData.value;
  }

  set themeData(themeData: ThemeData | undefined) {
    this.#themeData.next(themeData);
  }

  addStagedInput(inputEvent: TextInputEvent) {
    this.#stagedInput.push(inputEvent);
  }

  /**
   * There will be new input event added to stagedInput.
   * So we need to swap the array.
   */
  #emitStagedInput() {
    if (this.#stagedInput.length === 0) {
      return;
    }
    const newInput: TextInputEvent[] = [];
    const oldInput = this.#stagedInput;
    this.#stagedInput = newInput;
    for (let i = 0; i < oldInput.length; i++) {
      this.textInput$.next(oldInput[i]);
    }
  }

  #initBlockCreated() {
    this.onEveryBlock
      .pipe(takeUntil(this.dispose$))
      .subscribe((block: Block) => {
        block.setEditor(this);
      });

    for (const block of this.state.blocks.values()) {
      this.onEveryBlock.next(block);
    }

    this.state.newBlockCreated
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.onEveryBlock);
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

  fullRender(done?: AfterFn) {
    this.render(
      {
        flags: RenderFlag.Full,
      },
      done
    );
  }

  render(option: RenderOption, done?: AfterFn) {
    try {
      const newDom = this.#renderer.render(option, this.#renderedDom);
      if (!this.#renderedDom) {
        this.#container.appendChild(newDom);
        newDom.contentEditable = "true";
        if (this.controller.options?.spellcheck === false) {
          newDom.spellcheck = false;
        }

        this.#themeData
          .pipe(takeUntil(this.dispose$))
          .subscribe((themeData) => {
            if (isString(themeData?.primary?.color)) {
              this.#container.style.setProperty(
                "--blocky-primary-color",
                themeData!.primary!.color
              );
            } else {
              this.#container.style.setProperty("--blocky-primary-color", null);
            }

            if (isString(themeData?.font)) {
              this.#container.style.setProperty(
                "--blocky-font",
                themeData!.font!
              );
            } else {
              this.#container.style.setProperty(
                "--blocky-font",
                blockyDefaultFonts
              );
            }
          });

        fromEvent(newDom, "input")
          .pipe(takeUntil(this.dispose$))
          .subscribe(() => {
            if (this.composing) {
              return;
            }
            this.#handleContentChanged();
          });
        fromEvent(newDom, "compositionstart")
          .pipe(takeUntil(this.dispose$))
          .subscribe(this.#handleCompositionStart);
        fromEvent(newDom, "compositionend")
          .pipe(takeUntil(this.dispose$))
          .subscribe(this.#handleCompositionEnd);
        fromEvent<KeyboardEvent>(newDom, "keydown")
          .pipe(takeUntil(this.dispose$))
          .subscribe(this.#handleKeyDown);
        fromEvent<ClipboardEvent>(newDom, "copy")
          .pipe(takeUntil(this.dispose$))
          .subscribe(this.#handleCopy);
        fromEvent<ClipboardEvent>(newDom, "paste")
          .pipe(takeUntil(this.dispose$))
          .subscribe(this.#handlePaste);
        fromEvent(newDom, "blur")
          .pipe(takeUntil(this.dispose$))
          .subscribe(this.#handleEditorBlur);

        this.#renderedDom = newDom;
      }

      if (done) {
        done();
      } else {
        this.#handleSelectionChanged(CursorStateUpdateReason.contentChanged);
      }
    } catch (err) {
      console.error(err);
      this.controller.options?.onError?.(err);
      return;
    }

    this.controller.__emitNextTicks();
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
      const node = parent._mgNode as BlockDataElement | undefined;
      if (!node) {
        return false;
      }

      this.state.__setCursorState(
        CursorState.collapse(node.id, 0),
        CursorStateUpdateReason.changeset
      );

      return true;
    }

    return false;
  }

  #handleTreeNodeNotFound(startContainer: Node) {
    if (!this.#trySelectOnParent(startContainer)) {
      this.state.__setCursorState(null, CursorStateUpdateReason.changeset);
    }
  }

  #findBlockNodeContainer(node: Node): BlockDataElement | undefined {
    let ptr: Node | null = node;

    while (ptr) {
      const node = ptr._mgNode as BlockDataElement | undefined;
      if (node && isUpperCase(node.t)) {
        return node;
      }

      ptr = ptr.parentNode;
    }

    return;
  }

  #findTextOffsetInBlock(
    blockNode: BlockDataElement,
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
      this.state.__setCursorState(null, reason);
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
        this.state.__setCursorState(
          CursorState.collapse(startNode.id, absoluteStartOffset),
          reason
        );
      }

      this.#showToolbarByCursorState(newCursorState);
      return;
    }

    const endNode = this.#findBlockNodeContainer(endContainer);
    if (!endNode) {
      this.state.__setCursorState(null, reason);
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
      this.state.__setCursorState(
        new CursorState(
          startNode.id,
          absoluteStartOffset,
          endNode.id,
          absoluteEndOffset
        ),
        reason
      );
    }

    this.#showToolbarByCursorState(newCursorState);

    if (this.#followerWidget) {
      this.#followerWidget.dispose();
      this.#followerWidget = undefined;
    }
  }

  /**
   * After the changeset is applied, the selection doesn't change immediately.
   * It needs debounce to show.
   */
  #showToolbarByCursorState = debounce((newCursorState: CursorState) => {
    const selection = window.getSelection();
    if (!selection) {
      return;
    }
    if (selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    if (this.toolbarDelegate.enabled) {
      if (newCursorState.startId !== "Title" && this.#tryPlaceToolbar(range)) {
        this.toolbarDelegate.show();
      } else {
        this.toolbarDelegate.hide();
      }
    }
  }, 100);

  #tryPlaceToolbar(range: Range): boolean {
    const { cursorState } = this.state;
    if (!cursorState) {
      return false;
    }

    if (cursorState.isCollapsed) {
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
    const y =
      rect.y - containerRect.y - rect.height + this.toolbarDelegate.offsetY;

    this.toolbarDelegate.setPosition(x, y);

    return true;
  }

  #checkMarkedDom(changeset: Changeset, node: Node, currentOffset?: number) {
    const treeNode = node._mgNode as BlockDataElement;
    if (!node.parentNode) {
      // dom has been removed

      this.destructBlockNode(node);

      changeset.removeNode(treeNode);
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
    blockNode: BlockDataElement,
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
    this.state.__setCursorState(null, CursorStateUpdateReason.changeset);
    this.render(
      {
        flags: RenderFlag.Full,
      },
      () => {
        this.state.__setCursorState(
          storedCursorState,
          CursorStateUpdateReason.changeset
        );
      }
    );
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
    const finalizedChangeset = change.apply({
      // But there is an special case:
      // When the line became empty, we need to clear the empty <br/> created
      // by the browser.
      updateView: false,
    });
    if (finalizedChangeset) {
      this.#rerenderEmptyLines(finalizedChangeset);
    }
    // this is essential because the cursor will change
    // after the user typing.
    this.#handleSelectionChanged(CursorStateUpdateReason.contentChanged);

    this.contentChanged$.next();
  };

  /**
   *
   * Theoretically, we don't need to re-render after the user typed.
   * But there is an special case:
   * When the line became empty, we need to clear the empty <br/> created
   * by the browser.
   *
   * So the editor call the `render` method.
   *
   */
  #rerenderEmptyLines(changeset: FinalizedChangeset) {
    for (const op of changeset.operations) {
      if (op.op !== "text-edit") {
        continue;
      }
      this.#renderer.renderTextBlockByOperation(changeset, op);
    }
  }

  createSearchContext(content: string): SearchContext {
    if (!this.#searchContext) {
      this.#searchContext = new SearchContext(this.#container, this);
      this.#searchContext.dispose$.pipe(take(1)).subscribe(() => {
        this.#searchContext = undefined;
      });
    }
    this.#searchContext.search(content);
    return this.#searchContext;
  }

  placeSpannerAt(blockContainer: HTMLElement, node: BlockDataElement) {
    if (!this.spannerDelegate) {
      return;
    }
    const block = this.state.blocks.get(node.id);
    if (!block) {
      return;
    }

    let { x, y } = this.#getRelativeOffsetByDom(blockContainer);

    const offset = block.getSpannerOffset();
    x += offset.x;
    y += offset.y;

    x -= this.spannerDelegate.width;

    this.spannerDelegate.focusedNode = node;
    this.spannerDelegate.show();
    this.spannerDelegate.setPosition(x, y);
  }

  /**
   * Remove node and call the destructor
   */
  destructBlockNode(node: Node) {
    if (node._mgNode) {
      const treeNode = node._mgNode as BlockDataElement;

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

  #hideSpanner = () => {
    this.spannerDelegate?.hide();
  };

  #handleCompositionStart = () => {
    this.composing = true;
    this.compositionStart$.next();
  };

  #handleCompositionEnd = () => {
    this.composing = false;
    this.#handleContentChanged();
    this.compositionEnd$.next();
  };

  #handleKeyDown = (e: KeyboardEvent) => {
    this.keyDown$.next(e);
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

  #insertEmptyTextBeforeBlock(element: BlockDataElement) {
    const newTextElement = this.state.createTextElement();
    const parent = element.parent!;

    new Changeset(this.state)
      .insertChildrenAfter(parent, [newTextElement], element.prevSibling)
      .setCursorState(CursorState.collapse(element.id, 0))
      .apply();
  }

  #insertEmptyTextAfterBlock(element: BlockDataElement) {
    const newTextElement = this.state.createTextElement();
    const parent = element.parent!;

    new Changeset(this.state)
      .insertChildrenAfter(parent, [newTextElement], element)
      .setCursorState(CursorState.collapse(newTextElement.id, 0))
      .apply();
  }

  #commitNewLine() {
    let { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (!cursorState.isCollapsed) {
      this.controller.deleteContentInsideInSelection(cursorState);
      cursorState = this.state.cursorState;
    }
    if (!cursorState) {
      return;
    }
    const blockElement = this.state.getBlockElementById(cursorState.id);
    if (!blockElement) {
      return;
    }

    if (!this.state.isTextLike(blockElement)) {
      // default behavior
      this.#insertEmptyTextAfterBlock(blockElement);
      this.scrollInViewIfNeed();
      return;
    }
    const textModel = blockElement.getTextModel("textContent")!;

    const cursorOffset = cursorState.offset;

    // If the currentOffset are 0, we don't want to split
    // the text into two lines.
    // Insert an empty line before this line will be better.
    if (cursorOffset === 0) {
      this.#insertEmptyTextBeforeBlock(blockElement);
    } else {
      const slices = textModel.delta.slice(cursorOffset);

      const textType = getTextTypeForTextBlock(blockElement);
      const num = blockElement.getAttribute("num");
      const attributes = Object.create(null);
      if (this.preservedTextType.has(textType)) {
        // preserved data type
        attributes.textType = textType;
        if (isNumber(num)) {
          attributes.num = num + 1;
        }
      }

      const children: DataBaseNode[] = [];
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
      const changeset = new Changeset(this.state);
      changeset.textEdit(blockElement, "textContent", () =>
        new Delta().retain(cursorOffset).delete(textModel.length - cursorOffset)
      );

      if (blockElement.t === TitleBlock.Name) {
        changeset.insertChildrenAfter(this.state.document.body, [
          newTextElement,
        ]);
      } else {
        const parentElement = blockElement.parent! as DataBaseElement;
        changeset
          .deleteChildrenAt(blockElement, 0, children.length)
          .insertChildrenAfter(parentElement, [newTextElement], blockElement);
      }

      changeset
        .setCursorState(CursorState.collapse(newTextElement.id, 0))
        .apply();
    }

    this.scrollInViewIfNeed();
  }

  scrollInViewIfNeed() {
    window.requestAnimationFrame(() => this.#indeedScrollInView());
  }

  #indeedScrollInView() {
    const scrollContainerGetter = this.controller.options?.scrollContainer;
    if (isUndefined(scrollContainerGetter)) {
      return;
    }
    let scrollContainer: HTMLElement;
    if (isFunction(scrollContainerGetter)) {
      scrollContainer = scrollContainerGetter();
    } else {
      scrollContainer = scrollContainerGetter;
    }
    if (isUndefined(scrollContainer)) {
      return;
    }
    const selection = window.getSelection()!;
    if (selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);

    if (!isContainNode(range.startContainer, this.#container)) {
      return;
    }

    const rects = range.getClientRects();
    if (!rects || rects.length === 0) {
      return;
    }
    const lastRect = rects.item(rects.length - 1)!;

    if (lastRect.y > window.innerHeight * 0.8) {
      scrollContainer.scrollTop += lastRect.y - window.innerHeight * 0.8;
    }
  }

  #handleBeforeChangesetApply = (changeset: FinalizedChangeset) => {
    const { afterCursor, options } = changeset;
    if (!isUndefined(afterCursor) || options.refreshCursor) {
      this.state.__setCursorState(
        null,
        CursorStateUpdateReason.beforeChangeset
      );
    }
  };

  #handleChangesetApplied = (changeset: FinalizedChangeset) => {
    const { options } = changeset;
    const isThisUser = changeset.userId === this.controller.userId;
    const needsRender = options.updateView || changeset.forceUpdate;
    changeset.needsRender = needsRender;
    if (needsRender) {
      this.render(
        {
          changeset,
          flags: RenderFlag.Incremental,
        },
        () => {
          if (!isThisUser) {
            return;
          }
          if (!isUndefined(changeset.afterCursor)) {
            this.state.__setCursorState(
              changeset.afterCursor,
              CursorStateUpdateReason.changeset
            );
          } else if (options.refreshCursor) {
            this.state.__setCursorState(
              changeset.beforeCursor,
              CursorStateUpdateReason.changeset
            );
          }
        }
      );
    }
  };

  #handleChangesetApplied2 = (changeset: FinalizedChangeset) => {
    // we need to make the state.changesetApplied finished
    // there should be some data sync jobs
    this.#emitStagedInput();
    this.#refreshSearch();

    if (!changeset.needsRender) {
      this.controller.__emitNextTicks();
    }
  };

  #refreshSearch() {
    if (!this.#searchContext) {
      return;
    }
    this.#searchContext.hide();
    this.#debouncedRefreshSearch();
  }

  #debouncedRefreshSearch = debounce(() => this.#searchContext?.refresh(), 300);

  openExternalLink(link: string) {
    const launcher = this.controller.options?.urlLauncher;
    if (launcher) {
      try {
        launcher(link);
      } catch (err) {
        console.error(err);
      }
      return;
    }
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
  #findPreviousElement(node: BlockDataElement): BlockDataElement | undefined {
    let ptr = node.prevSibling as BlockDataElement | undefined;
    if (!ptr) {
      return ptr;
    }
    while (ptr.lastChild) {
      ptr = ptr!.lastChild as BlockDataElement;
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

    if (node.t !== TextBlock.Name) {
      return false;
    }

    const prevNode = this.#findPreviousElement(node);
    if (!prevNode) {
      return true;
    }

    if (prevNode.t !== TextBlock.Name) {
      this.state.__setCursorState(
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
      .removeNode(node)
      .setCursorState(CursorState.collapse(prevNode.id, originalLength))
      .apply();

    return true;
  }

  #getBlockElementAtCollapsedCursor(): BlockDataElement | undefined {
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

    const blockDef = this.registry.block.getBlockDefByName(node.t);
    if (isUndefined(blockDef)) {
      throw new Error(`definition not found for ${node.t}`);
    }

    if (blockDef.Editable !== false) {
      return false;
    }

    const changeset = new Changeset(this.state);

    changeset.removeNode(node);

    if (prevNode) {
      changeset.setCursorState(CursorState.collapse(prevNode.id, 0));
      this.#focusEndOfNode(changeset, prevNode);
    } else {
      changeset.setCursorState(null);
    }

    changeset.apply();

    return true;
  }

  #focusEndOfNode(changeset: Changeset, node: BlockDataElement) {
    if (node.t === TextBlock.Name) {
      const textModel = node.getTextModel("textContent")!;
      changeset.setCursorState(CursorState.collapse(node.id, textModel.length));
    } else {
      changeset.setCursorState(CursorState.collapse(node.id, 0));
    }
  }

  handleCursorStateChanged = (evt: CursorStateUpdateEvent) => {
    const sel = window.getSelection();
    if (!sel) {
      return;
    }

    const newState = evt.state;

    if (
      evt.reason === CursorStateUpdateReason.contentChanged ||
      evt.reason === CursorStateUpdateReason.uiEvent
    ) {
      // Although the selection is submitted by UIEvents,
      // we don't need to fetch the selection from the browser.
      // we still need to reset the focused state.
      if (newState?.isCollapsed && newState.id !== evt.prevState?.id) {
        const targetNode = this.state.domMap.get(newState.id)!;
        if (targetNode instanceof HTMLDivElement) {
          this.#focusBlock(sel, targetNode, newState);
        }
      }
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
      if (targetNode.nodeName !== TextBlock.Name) {
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
    const node = blockDom._mgNode as BlockDataElement | undefined;
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

    if (blockElement.t === TextBlock.Name || blockElement.t === "Title") {
      return;
    }

    const blockData = blockElement.toJSON();
    console.log(JSON.stringify(blockData).replace(/"/g, '\\"'));
    e.clipboardData?.clearData();
    e.clipboardData?.setData(
      "text/html",
      `<div data-id="${blockElement.id}" data-type="${
        blockElement.t
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
      this.#insertTextAtCursor(plainText);
      return;
    }
  };

  #insertTextAtCursor(text: string) {
    let { cursorState } = this.state;

    if (cursorState?.isOpen) {
      this.controller.deleteContentInsideInSelection(cursorState);
      cursorState = this.state.cursorState;
    }

    if (!cursorState) {
      return null;
    }

    const lines = text
      .split("\n")
      .map((t) => t.replaceAll(/\t|\r/g, ""))
      .map(textToDeltaWithURL);

    if (lines.length === 0) {
      return;
    } else if (lines.length === 1) {
      const textElement = this.getTextElementByBlockId(cursorState.id);
      if (!textElement) {
        return null;
      }
      const firstLine = lines[lines.length - 1];
      const afterOffset = cursorState.offset + text.length;
      new Changeset(this.state)
        .textEdit(textElement, "textContent", () =>
          new Delta().retain(cursorState!.offset).concat(firstLine)
        )
        .setCursorState(CursorState.collapse(cursorState.id, afterOffset))
        .apply();
    } else {
      this.#insertMultipleLinesAt(cursorState, lines);
    }
  }

  #insertMultipleLinesAt(cursorState: CursorState, lines: Delta[]) {
    if (lines.length <= 1) {
      return;
    }
    const changeset = new Changeset(this.state);
    const textElement = this.getTextElementByBlockId(cursorState.id);
    if (!textElement) {
      return;
    }
    const firstLineModel = textElement.getTextModel("textContent")!;
    const firstLineRemains = firstLineModel.delta.slice(cursorState.offset);
    const remainLength = firstLineModel.length - cursorState.offset;
    changeset.textEdit(textElement, "textContent", () =>
      new Delta()
        .retain(cursorState.offset)
        .delete(remainLength)
        .concat(lines[0])
    );
    const appendElements: BlockDataElement[] = [];
    for (let i = 1; i < lines.length; i++) {
      let delta = lines[i];
      if (i === lines.length - 1) {
        const lineOriginalLen = delta.length();
        delta = delta.concat(firstLineRemains);
        const newTextElement = this.state.createTextElement(delta);
        changeset.setCursorState(
          CursorState.collapse(newTextElement.id, lineOriginalLen)
        );
        appendElements.push(newTextElement);
      } else {
        const newTextElement = this.state.createTextElement(delta);
        appendElements.push(newTextElement);
      }
    }

    changeset.insertChildrenAfter(
      textElement.parent!,
      appendElements,
      textElement
    );

    changeset.apply();
  }

  getTextElementByBlockId(blockId: string): BlockDataElement | undefined {
    const treeNode = this.state.getBlockElementById(blockId);
    if (!treeNode) {
      return;
    }

    if (treeNode.t === TextBlock.Name) {
      return treeNode;
    }
  }

  handleHandleBlockDrop(block: ContentBlock) {
    if (!this.darggingNode) {
      return;
    }
    const dropBlockElement = block.elementData as BlockDataElement;
    if (this.darggingNode.id === dropBlockElement.id) {
      // it's the same
      return;
    }

    const cloned = this.darggingNode.clone();
    new Changeset(this.state)
      .removeChild(this.darggingNode.parent!, this.darggingNode)
      .insertChildrenAfter(dropBlockElement, [cloned])
      .apply();
  }

  insertFollowerWidget(widget: FollowerWidget) {
    this.#followerWidget?.dispose();
    this.#followerWidget = widget;
    this.#container.insertBefore(widget.container, this.#container.firstChild);
    widget.startCursorState = this.state.cursorState!;
    widget.dispose$.pipe(take(1)).subscribe(() => {
      this.#followerWidget = undefined;
    });
    widget.widgetMounted(this.controller);

    window.requestAnimationFrame(() => {
      this.#placeFollowWidgetUnderCursor(widget);
    });
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
    if (rects.length === 0) {
      return;
    }

    const last = rects.item(rects.length - 1)!;
    let x = last.x;
    let y = last.y;

    const atTopMaxHeight = this.#shouldPlaceAtTheTopOfCursor(
      last.y,
      followWidget
    );

    const containerRect = this.#container.getBoundingClientRect();
    x -= containerRect.x;
    y -= containerRect.y;

    if (isNumber(atTopMaxHeight)) {
      y -= atTopMaxHeight;
      followWidget.atTop = true;
    } else {
      y += followWidget.yOffset;
      followWidget.atTop = false;
    }

    followWidget.x = x;
    followWidget.y = y;

    followWidget.widgetAfterReposition?.();
  }

  // return height
  #shouldPlaceAtTheTopOfCursor(
    y: number,
    followerWidget: FollowerWidget
  ): number | undefined {
    const { maxHeight } = followerWidget;
    let scrollContainer = this.controller.options?.scrollContainer;
    if (isFunction(scrollContainer)) {
      scrollContainer = scrollContainer();
    }
    if (!scrollContainer) {
      return;
    }
    const scrollContainerHeight = scrollContainer.clientHeight;
    if (isNumber(maxHeight)) {
      if (y + maxHeight > scrollContainerHeight) {
        return maxHeight;
      }
    }
    return;
  }

  focus() {
    if (!this.#renderedDom) {
      return;
    }
    this.#renderedDom.focus();
  }

  dispose() {
    this.dispose$.next();
    this.#followerWidget?.dispose();
    this.#followerWidget = undefined;
    document.removeEventListener(
      "selectionchange",
      this.#selectionChangedHandler
    );
    flattenDisposable(this.disposables).dispose();
  }
}
