import { $on, isContainNode, removeNode } from "blocky-common/es/dom";
import { Cell } from "blocky-common/es/cell";
import { observe, runInAction } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import { type Padding } from "blocky-common/es/dom";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import { type Position } from "blocky-common/es/position";
import { DocRenderer } from "@pkg/view/renderer";
import { State as DocumentState, type AttributesObject, TextType, BlockyTextModel, BlockyElement } from "@pkg/model";
import { CollapsedCursor, OpenCursorState, type CursorState } from "@pkg/model/cursor";
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
import { Block, BlockElement, BlockPasteEvent, TryParsePastedDOMEvent } from "@pkg/block/basic";
import { setTextTypeForTextBlock, getTextTypeForTextBlock } from "@pkg/block/textBlock";
import { isHotkey } from "is-hotkey";

const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function areEqualShallow(a: any, b: any) {
  if (typeof a === "object" && typeof b === "object") {
    for (let key in a) {
      if (!(key in b) || a[key] !== b[key]) {
        return false;
      }
    }
    for (let key in b) {
      if (!(key in a)) {
        return false;
      }
    }
    return true;
  } else {
    return a === b;
  }
}

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
}

enum MineType  {
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

/**
 * The internal view layer object of the editor.
 * It's not recommended to manipulate this class by the user.
 * The user should use `EditorController` to manipulate the editor.
 *
 * This class is designed to used internally. This class can be
 * used by the plugins to do something internally.
 */
export class Editor {
  #container: HTMLDivElement;
  #renderedDom: HTMLDivElement | undefined;
  #renderer: DocRenderer;
  #lastFocusedId: string | undefined;
  #isUpdating: boolean = false;
  public readonly bannerDelegate: BannerDelegate;
  public readonly toolbarDelegate: ToolbarDelegate;
  public idGenerator: IdGenerator;

  public readonly anchorSpanClass: string = "blocky-text-anchor";

  public readonly state: DocumentState;
  public readonly registry: EditorRegistry;
  public readonly keyDown = new Slot<KeyboardEvent>();

  public readonly preservedTextType: Set<TextType> = new Set([TextType.Bulleted]);

  public readonly padding: Padding;
  private bannerXOffset: number;

  public composing: boolean = false;
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
    });
    controller.mount(editor);
    return editor;
  }

  constructor(
    public readonly controller: EditorController,
    options: IEditorOptions
  ) {
    const {
      container,
      state,
      registry,
      idGenerator,
      bannerFactory,
      toolbarFactory,
      padding,
      bannerXOffset,
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

    this.bannerDelegate = new BannerDelegate(controller, bannerFactory);
    this.bannerDelegate.mount(this.#container);
    this.disposables.push(this.bannerDelegate);

    this.toolbarDelegate = new ToolbarDelegate(controller, toolbarFactory);
    this.toolbarDelegate.mount(this.#container);
    this.disposables.push(this.toolbarDelegate);

    document.addEventListener("selectionchange", this.selectionChanged);

    this.disposables.push(
      observe(state, "cursorState", this.handleCursorStateChanged)
    );

    this.disposables.push($on(container, "mouseleave", this.hideBanner));

    this.registry.plugin.emitInitPlugins(this);

    this.#renderer = new DocRenderer({
      clsPrefix: "blocky",
      editor: this,
    });

    this.initBlockCreated();
  }

  private initBlockCreated() {
    this.disposables.push(
      this.state.newBlockCreated.on((block: Block) => {
        block.setEditor(this);
      })
    );

    for (const block of this.state.blocks.values()) {
      this.state.newBlockCreated.emit(block);
    }
  }

  public render(done?: AfterFn) {
    const newDom = this.#renderer.render(this.#renderedDom);
    if (!this.#renderedDom) {
      this.#container.appendChild(newDom);
      newDom.contentEditable = "true";

      $on(newDom, "input", (e: Event) => {
        if (this.composing) {
          return;
        }
        this.handleContentChanged(e);
      });
      $on(newDom, "compositionstart", this.handleCompositionStart);
      $on(newDom, "compositionend", this.handleCompositionEnd);
      $on(newDom, "keydown", this.handleKeyDown);
      $on(newDom, "paste", this.handlePaste);

      this.#renderedDom = newDom;
    }

    if (done) {
      done();
    } else {
      this.selectionChanged();
    }

    this.controller.emitNextTicks();
  }

  private trySelectOnParent(startContainer: Node): boolean {
    const parent = startContainer.parentNode;
    if (!parent) {
      return false;
    }

    // parent is block
    if (parent instanceof HTMLElement && parent.classList.contains(this.#renderer.blockClassName)) {
      const node = parent._mgNode as BlockElement | undefined;
      if (!node) {
        return false;
      }

      this.state.cursorState = {
        type: "collapsed",
        targetId: node.id,
        offset: 0
      };

      return true;
    }

    return false;
  }

  private handleTreeNodeNotFound(startContainer: Node) {
    if (!this.trySelectOnParent(startContainer)) {
      this.state.cursorState = undefined;
    }
  }

  private findBlockNodeContainer(node: Node): BlockElement | undefined {
    let ptr: Node | null = node;

    while (ptr) {
      const node = ptr._mgNode as BlockElement | undefined;
      if (node) {
        return node;
      }

      ptr = ptr.parentNode;
    }

    return;
  }
  
  private findTextOffsetInBlock(blockNode: BlockElement, focusedNode: Node, offsetInNode: number): number {
    const block = this.state.blocks.get(blockNode.id)!;

    return block.findTextOffsetInBlock(focusedNode, offsetInNode);
  }

  private selectionChanged = () => {
    const sel = window.getSelection();
    if (!sel) {
      return;
    }

    if (sel.rangeCount === 0) {
      return;
    }

    const range = sel.getRangeAt(0);
    const { startContainer, endContainer, startOffset, endOffset } = range;

    // not a dom in this editor, ignore it.
    if (!isContainNode(startContainer, this.#container)) {
      return;
    }

    const startNode = this.findBlockNodeContainer(startContainer);
    if (!startNode) {
      this.handleTreeNodeNotFound(startContainer);
      return;
    }

    const absoluteStartOffset = this.findTextOffsetInBlock(startNode, startContainer, startOffset);

    if (range.collapsed) {
      this.state.cursorState = {
        type: "collapsed",
        targetId: startNode.id,
        offset: absoluteStartOffset,
      };
    } else {
      const endNode = this.findBlockNodeContainer(endContainer);
      if (!endNode) {
        this.state.cursorState = undefined;
        return;
      }
      const absoluteEndOffset = this.findTextOffsetInBlock(endNode, endContainer, endOffset);
      this.state.cursorState = {
        type: "open",
        startId: startNode.id,
        startOffset: absoluteStartOffset,
        endId: endNode.id,
        endOffset: absoluteEndOffset,
      };
    }

    const { toolbarDelegate } = this;

    if (toolbarDelegate.enabled) {
      if (this.tryPlaceToolbar(range)) {
        toolbarDelegate.show();
      } else {
        toolbarDelegate.hide();
      }
    }
  };

  private tryPlaceToolbar(range: Range): boolean {
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

  private checkMarkedDom(
    node: Node,
    currentOffset?: number,
  ) {
    const treeNode = node._mgNode as BlockElement;
    const targetId = treeNode.id;
    if (!node.parentNode) {
      // dom has been removed

      this.destructBlockNode(node);
      const result = this.state.deleteBlock(targetId);
      if (!result) {
        console.log("delete failed:", targetId);
      }
      return;
    }

    this.checkBlockContent(node, treeNode, currentOffset);
  }

  /**
   * Check if there is new span created by the browser
   */
  private checkBlockContent(
    node: Node,
    blockNode: BlockElement,
    currentOffset?: number,
  ) {
    const block = this.state.blocks.get(blockNode.id);

    block?.blockContentChanged({
      node: node as HTMLDivElement,
      offset: currentOffset,
    });
  }

  private checkNodesChanged() {
    const doms = this.state.domMap.values();
    for (const dom of doms) {
      this.checkMarkedDom(dom, undefined);
    }
  }

  private handleOpenCursorContentChanged() {
    this.checkNodesChanged();
    this.render();
  }

  private handleContentChanged = (e?: any) => {
    const { cursorState } = this.state;
    if (cursorState === undefined || cursorState.type === "open") {
      this.handleOpenCursorContentChanged();
      return;
    }

    const { targetId: spanId, offset: currentOffset } = cursorState;

    const domNode = this.state.domMap.get(spanId);
    if (!domNode) {
      return;
    }

    this.checkMarkedDom(domNode, currentOffset);
  };

  public placeBannerAt(blockContainer: HTMLElement, node: BlockElement) {
    const block = this.state.blocks.get(node.id);
    if (!block) {
      return;
    }

    let { x, y } = this.getRelativeOffsetByDom(blockContainer);

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
  public destructBlockNode(node: Node) {
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
  private getRelativeOffsetByDom(element: HTMLElement): Position {
    const containerRect = this.#container.getBoundingClientRect();
    const blockRect = element.getBoundingClientRect();
    return {
      x: blockRect.x - containerRect.x,
      y: blockRect.y - containerRect.y,
    };
  }

  private hideBanner = () => {
    this.bannerDelegate.hide();
  };

  private handleCompositionStart = (e: CompositionEvent) => {
    this.composing = true;
  };

  private handleCompositionEnd = (e: CompositionEvent) => {
    this.composing = false;
    this.handleContentChanged();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keyDown.emit(e);
    if (e.defaultPrevented) {
      return;
    }

    if (e.key === "Tab") {
      this.handleKeyTab(e);
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
        this.commitNewLine();
      }
    } else if (e.key === "Backspace") {
      this.handleBackspace(e);
    } else if (e.key === "Delete") {
      this.handleDelete(e);
    } else if (isHotkey("mod+z", e)) {
      // temporary disable undo
      e.preventDefault();
    }
  };

  private handleKeyTab(e: KeyboardEvent) {
    e.preventDefault();
  }

  public createTextElement(): BlockElement {
    const result = new BlockElement(TextBlockName, this.idGenerator.mkBlockId());
    const textModel = new BlockyTextModel();
    result.contentContainer.appendChild(textModel);
    return result;
  }

  private insertEmptyTextAfterBlock(parent: BlockyElement, afterId: string) {
    const newTextElement = this.createTextElement();
    const currentBlock = this.state.idMap.get(afterId);

    this.update(() => {
      parent.insertAfter(newTextElement, currentBlock);

      return () => {
        this.state.cursorState = {
          type: "collapsed",
          targetId: newTextElement.id,
          offset: 0,
        };
      };
    });
  }

  private commitNewLine() {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.type === "collapsed") {
      const blockElement = this.state.idMap.get(cursorState.targetId) as BlockElement | undefined;
      if (!blockElement) {
        return;
      }

      if (blockElement.blockName !== TextBlockName) {
        // default behavior
        this.insertEmptyTextAfterBlock(blockElement.parent! as BlockyElement, cursorState.targetId);
        return;
      }
      const textModel = blockElement.contentContainer.firstChild! as BlockyTextModel;

      const cursorOffset = cursorState.offset;

      const slices = textModel.slice(cursorOffset);

      const newTextElement = this.createTextElement();
      const newTextModel = newTextElement.contentContainer.firstChild! as BlockyTextModel;
      const textType = getTextTypeForTextBlock(blockElement);
      if (this.preservedTextType.has(textType)) {  // preserved data type
        setTextTypeForTextBlock(newTextElement, textType);
      }

      let ptr = 0;
      for (const slice of slices) {
        newTextModel.insert(ptr, slice.content, slice.attributes);
        ptr += slice.content.length;
      }

      textModel.delete(cursorOffset, textModel.length - cursorOffset);
      
      this.update(() => {
        const parentElement = blockElement.parent! as BlockyElement;
        parentElement.insertAfter(newTextElement, blockElement);

        return () => {
          this.state.cursorState = {
            type: "collapsed",
            targetId: newTextElement.id,
            offset: 0,
          };
        };
      });
    } else {
      console.error("unhandled");
    }
  }

  /**
   * Update the state in fn, after
   * fn is called, the render function
   * will be called.
   */
  public update(fn: () => AfterFn | void) {
    if (this.#isUpdating) {
      throw new Error("is in updating process");
    }

    this.#isUpdating = true;
    try {
      let done: AfterFn | void;
      runInAction(this.state, () => {
        done = fn();
      });
      this.render(() => {
        done?.();
        this.selectionChanged();
      });
    } finally {
      this.#isUpdating = false;
    }
  }

  public openExternalLink(link: string) {
    // TODO: handle this in plugin
    window.open(link, '_blank')?.focus();
  }

  private handleDelete(e: KeyboardEvent) {
    if (this.deleteBlockOnFocusedCursor()) {
      e.preventDefault();
    }
  }

  private handleBackspace(e: KeyboardEvent) {
    if (this.deleteBlockOnFocusedCursor()) {
      e.preventDefault();
    }
  }

  private deleteBlockOnFocusedCursor(): boolean {
    const { cursorState } = this.state;
    if (!cursorState) {
      return false;
    }
    if (cursorState.type === "open") {
      return false;
    }

    const { targetId } = cursorState;

    if (!this.idGenerator.isBlockId(targetId)) {
      return false;
    }

    const node = this.state.idMap.get(targetId) as BlockElement | undefined;
    if (!node) {
      return false;
    }
    const prevNode = node.prevSibling as BlockElement;

    const blockDef = this.registry.block.getBlockDefByName(node.blockName)!;

    if (blockDef.editable !== false) {
      return false;
    }

    this.update(() => {
      this.state.deleteBlock(targetId);
      return () => {
        if (prevNode) {
          this.state.cursorState = {
            type: "collapsed",
            targetId: prevNode.id,
            offset: 0,
          };
          this.focusEndOfNode(prevNode);
        } else {
          this.state.cursorState = undefined;
        }
      };
    });
    return true;
  }

  private focusEndOfNode(node: BlockElement) {
    if (node.blockName === TextBlockName) {
      const textModel = node.contentContainer.firstChild! as BlockyTextModel;
      this.state.cursorState = {
        type: "collapsed",
        targetId: node.id,
        offset: textModel.length,
      };
    } else {
      this.state.cursorState = {
        type: "collapsed",
        targetId: node.id,
        offset: 0,
      };
    }
  }

  public handleCursorStateChanged = (
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
      const range = sel.getRangeAt(0)
      const startContainer = range.startContainer;
      if (isContainNode(startContainer, this.#container)) {
        sel.removeAllRanges();
      }
      return;
    }

    if (newState.type === "open") {
      this.focusOnOpenCursor(newState, sel);
      return;
    }

    this.focusOnCollapsedCursor(newState, sel);
  };

  private focusOnCollapsedCursor(collapsedCursor: CollapsedCursor, sel: Selection) {
    const { targetId } = collapsedCursor;

    const targetNode = this.state.domMap.get(targetId);
    if (!targetNode) {
      throw new Error(`dom not found: ${targetId}`);
    }

    if (
      targetNode instanceof HTMLDivElement &&
      targetNode.classList.contains(this.#renderer.blockClassName)
    ) {
      this.focusBlock(sel, targetNode, collapsedCursor);
    } else {
      console.error("unknown element:", targetNode);
    }
  }

  private focusOnOpenCursor(openCursor: OpenCursorState, sel: Selection) {
    const { startId, startOffset, endId, endOffset } = openCursor;

    const startBlock = this.state.blocks.get(startId);
    if (!startBlock) {
      return;
    }

    const endBlock = this.state.blocks.get(endId);
    if (!endBlock) {
      return;
    }

    const startCursorDom = startBlock.getCursorDomByOffset(startOffset);

    if (!startCursorDom) {
      return;
    }

    const endCursorDom = endBlock.getCursorDomByOffset(endOffset);

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
  private focusBlock(
    sel: Selection,
    blockDom: HTMLDivElement,
    cursor: CollapsedCursor
  ) {
    const node = blockDom._mgNode as BlockElement | undefined
    if (!node) {
      return;
    }

    this.blurBlock();

    this.#lastFocusedId = node.id;
    const block = this.state.blocks.get(node.id)!;
    block.blockFocused({ node: blockDom, cursor, selection: sel });
  }

  private blurBlock() {
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
      block.blockBlur({
        node: dom as HTMLDivElement,
        cursor: this.state.cursorState,
        selection: sel,
      });
    }

    this.#lastFocusedId = undefined;
  }

  private handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();  // take over the paste event

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
      this.pastePlainTextOnCursor(plainText);
      return;
    }
  };

  /**
   * Use the API provided by the browser to parse the html for the bundle size.
   * Maybe use an external library is better for unit tests. But it will increase
   * the size of the bundles.
   */
  public pasteHTMLAtCursor(html: string) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, MineType.Html);
      this.pasteHTMLBodyOnCursor(doc.body);
    } catch (e) {
      console.error(e);
    }
  }

  private pasteHTMLBodyOnCursor(body: HTMLElement) {
    let ptr = body.firstElementChild;
    let afterCursor: CursorState | undefined = this.state.cursorState;

    let index = 0;
    while (ptr) {
      const cursor = this.pasteNodeAt(afterCursor, ptr as HTMLElement, index === 0);

      if (cursor) {
        afterCursor = cursor;
      }

      index++;
      ptr = ptr.nextElementSibling;
    }

    this.render(() => {
      this.state.cursorState = afterCursor;
    });
  }

  private tryPasteDivElementAsBlock(element: HTMLDivElement, cursorState: Cell<CursorState | undefined>, tryMerge: boolean = false): boolean {
    const blockRegistry = this.registry.block;
    const dataType = element.getAttribute("data-type");
    if (!dataType) {
      return false;
    }
    const blockDef = blockRegistry.getBlockDefByName(dataType);
    if (!blockDef) {
      return false;
    }

    const pasteHandler = blockDef?.onPaste;
    if (pasteHandler) {
      const evt = new BlockPasteEvent({
        after: cursorState.get(),
        editor: this,
        node: element,
        tryMerge,
      });
      const newCursor = pasteHandler.call(blockDef, evt);
      if (newCursor) {
        cursorState.set(newCursor);
      }
    } else {
      const newCursor = this.insertBlockByDefaultAt(cursorState.get(), dataType);
      if (newCursor) {
        cursorState.set(newCursor);
      }
    }

    return true;
  }

  /**
   * 
   * Paste the content of element at the cursor.
   * 
   * @param tryMerge Indicate whether the content should be merged to the previous block.
   */
  private pasteNodeAt(cursorState: CursorState | undefined, element: HTMLElement, tryMerge: boolean = false): CursorState | undefined {
    const blockRegistry = this.registry.block;

    const evt = new TryParsePastedDOMEvent({
      after: cursorState,
      editor: this,
      node: element,
    });
    blockRegistry.handlePasteElement(evt);
    if (evt.defaultPrevented) {
      return evt.after;
    }

    if (element instanceof HTMLSpanElement) {
      const attributes: AttributesObject = this.getAttributesBySpan(element);
      let textContent = "";

      const testContent = element.textContent;
      if (testContent) {
        textContent = testContent;
      }

      return this.insertTextAt(cursorState, textContent, Object.keys(attributes).length > 0 ? attributes : undefined);
    } else if (element instanceof HTMLDivElement) {
      const cursorCell = new Cell(cursorState);
      if (this.tryPasteDivElementAsBlock(element, cursorCell, tryMerge)) {
        return cursorCell.get();
      } else {
        console.warn("unknown dom:", element);
      }
    } else if (
      element instanceof HTMLParagraphElement ||
      element instanceof HTMLHeadingElement ||
      element instanceof HTMLLIElement
    ) {  // is a <p> or <h1>
      const blockDef = blockRegistry.getBlockDefByName(TextBlockName);
      const pasteHandler = blockDef?.onPaste;
      const evt = new BlockPasteEvent({
        after: cursorState,
        editor: this,
        node: element,
        tryMerge,
      });
      if (pasteHandler) {
        const cursor = pasteHandler.call(blockDef, evt);
        return cursor;
      } else {
       return this.insertBlockByDefaultAt(cursorState, TextBlockName);
      }
    } else if (element instanceof HTMLUListElement) {
      let childPtr = element.firstElementChild;
      let returnCursor: CursorState | undefined = cursorState;

      while (childPtr) {
        returnCursor = this.pasteNodeAt(returnCursor, childPtr as HTMLElement, false);
        childPtr = childPtr.nextElementSibling;
      }

      return returnCursor;
    } else {
      console.warn("unknown dom:", element);
    }
    return;
  }

  /**
   * Calculate the attributes from the dom.
   * It's used for pasting text, and to recognize the dom created by the browser.
   */
  public getAttributesBySpan(span: HTMLElement): AttributesObject {
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

  private insertBlockByDefaultAt(cursorState: CursorState | undefined, blockName: string): CursorState | undefined {
    if (!cursorState) {
      return;
    }

    if (cursorState.type === "open") {
      return;
    }

    const currentNode = this.state.idMap.get(cursorState.targetId)! as BlockElement;

    const textElement = this.createTextElement();

    const parentElement = currentNode.parent! as BlockyElement;
    parentElement.insertAfter(textElement, currentNode);

    return {
      type: "collapsed",
      targetId: textElement.id,
      offset: 0,
    };
  }

  private pastePlainTextOnCursor(text: string) {
    const cursor = this.insertTextAt(this.state.cursorState, text);
    this.render(() => {
      this.state.cursorState = cursor;
    });
  }

  private insertTextAt(cursorState: CursorState | undefined, text: string, attributes?: AttributesObject): CursorState | undefined {
    if (!cursorState) {
      return;
    }

    if (cursorState.type === "open") {
      return;
    }

    const textElement = this.getTextElementByBlockId(cursorState.targetId);
    if (!textElement) {
      return;
    }

    const afterOffset = cursorState.offset + text.length;
    const textModel = textElement.contentContainer.firstChild! as BlockyTextModel;
    textModel.insert(cursorState.offset, text, attributes);
    return {
      type: "collapsed",
      targetId: cursorState.targetId,
      offset: afterOffset
    };
  }

  getTextElementByBlockId(blockId: string): BlockElement | undefined {
    const treeNode = this.state.idMap.get(blockId) as BlockElement | undefined;
    if (!treeNode) {
      return;
    }

    if (treeNode.blockName === TextBlockName) {
      return treeNode;
    }
  }

  dispose() {
    document.removeEventListener("selectionchange", this.selectionChanged);
    flattenDisposable(this.disposables).dispose();
  }
}
