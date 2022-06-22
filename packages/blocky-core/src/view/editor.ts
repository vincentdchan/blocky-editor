import { $on, removeNode } from "blocky-common/es/dom";
import { Cell } from "blocky-common/es/cell";
import { observe, runInAction } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import { type Position } from "blocky-common/es/position";
import { DocRenderer } from "@pkg/view/renderer";
import {
  State as DocumentState,
  type TreeNode,
  TextModel,
  type AttributesObject,
  TextType,
} from "@pkg/model";
import { CollapsedCursor, OpenCursorState, type CursorState } from "@pkg/model/cursor";
import { Action } from "@pkg/model/actions";
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
import { Block, BlockPasteEvent, TryParsePastedDOMEvent } from "@pkg/block/basic";

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
}

enum MineType  {
  PlainText = "text/plain",
  Html = "text/html",
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
  public readonly bannerDelegate: BannerDelegate;
  public readonly toolbarDelegate: ToolbarDelegate;
  public idGenerator: IdGenerator;

  public readonly anchorSpanClass: string = "blocky-text-anchor";

  public readonly state: DocumentState;
  public readonly registry: EditorRegistry;
  public readonly keyDown = new Slot<KeyboardEvent>();

  public readonly preservedTextType: Set<TextType> = new Set([TextType.Bulleted]);

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
    } = options;
    this.state = state;
    this.registry = registry;
    this.#container = container;
    this.idGenerator = idGenerator ?? makeDefaultIdGenerator();

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
      const node = parent._mgNode as TreeNode | undefined;
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

  private findBlockNodeContainer(node: Node): TreeNode | undefined {
    let ptr: Node | null = node;

    while (ptr) {
      const node = ptr._mgNode as TreeNode | undefined;
      if (node) {
        return node;
      }

      ptr = ptr.parentNode;
    }

    return;
  }
  
  private findTextOffsetInBlock(blockNode: TreeNode, focusedNode: Node, offsetInNode: number): number {
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
    actions: Action[],
    currentOffset?: number,
  ) {
    const treeNode = node._mgNode as TreeNode;
    const targetId = treeNode.id;
    if (!node.parentNode) {
      // dom has been removed

      this.destructBlockNode(node);
      actions.push({
        type: "delete",
        targetId,
      });
      return;
    }

    this.checkBlockContent(node, treeNode, currentOffset);
  }

  /**
   * Check if there is new span created by the browser
   */
  private checkBlockContent(
    node: Node,
    blockNode: TreeNode,
    currentOffset?: number,
  ) {
    const block = this.state.blocks.get(blockNode.id);

    block?.blockContentChanged({
      node: node as HTMLDivElement,
      offset: currentOffset,
    });
  }

  private checkNodesChanged(actions: Action[]) {
    const doms = this.state.domMap.values();
    for (const dom of doms) {
      this.checkMarkedDom(dom, actions, undefined);
    }
  }

  private handleOpenCursorContentChanged() {
    const actions: Action[] = [];
    this.checkNodesChanged(actions);
    this.applyActions(actions);
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

    const actions: Action[] = [];

    this.checkMarkedDom(domNode, actions, currentOffset);
    this.applyActions(actions, true);
  };

  public applyActions(actions: Action[], noUpdate: boolean = false) {
    if (actions.length === 0) {
      return;
    }

    let afterFn: AfterFn | undefined;
    runInAction(this.state, () => {
      afterFn = this.registry.plugin.emitBeforeApply(this, actions);
      this.state.applyActions(actions);
    });
    if (noUpdate) {
      if (afterFn) {
        afterFn();
      } else if (actions.length > 0) {
        this.selectionChanged();
      }
    } else {
      this.render(() => {
        if (afterFn) {
          afterFn();
        } else if (actions.length > 0) {
          this.selectionChanged();
        }
      });
    }
  }

  public placeBannerAt(blockContainer: HTMLElement, node: TreeNode) {
    const block = this.state.blocks.get(node.id);
    if (!block) {
      return;
    }

    let { x, y } = this.getRelativeOffsetByDom(blockContainer);

    x = 24;

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
      const treeNode = node._mgNode as TreeNode;

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
    }
  };

  private handleKeyTab(e: KeyboardEvent) {
    e.preventDefault();
  }

  private insertEmptyTextAfterBlock(parentId: string, id: string) {
    const newTextModel = new TextModel();
    const newId = this.idGenerator.mkBlockId();
    const actions: Action[] = [
      {
        type: "new-block",
        blockName: TextBlockName,
        targetId: parentId,
        newId,
        afterId: id,
        data: newTextModel,
      },
    ];

    this.applyActions(actions);
    this.render(() => {
      this.state.cursorState = {
        type: "collapsed",
        targetId: newId,
        offset: 0,
      };
    });
  }

  private commitNewLine() {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.type === "collapsed") {
      const node = this.state.idMap.get(cursorState.targetId);
      if (!node) {
        return;
      }

      const blockData = node.data;
      const targetId = node.parent!.id;
      if (!blockData || !(blockData instanceof TextModel)) {
        // default behavior
        this.insertEmptyTextAfterBlock(targetId, cursorState.targetId);
        return;
      }
      const textModel = blockData as TextModel;

      const cursorOffset = cursorState.offset;

      const slices = textModel.slice(cursorOffset);

      const newTextModel = new TextModel();
      if (this.preservedTextType.has(textModel.textType)) {  // preserved data type
        newTextModel.textType = textModel.textType;
      }

      let ptr = 0;
      for (const slice of slices) {
        newTextModel.insert(ptr, slice.content, slice.attributes);
        ptr += slice.content.length;
      }

      textModel.delete(cursorOffset, textModel.length - cursorOffset);
      
      const newId = this.idGenerator.mkBlockId();
      const actions: Action[] = [
        {
          type: "new-block",
          blockName: TextBlockName,
          targetId,
          newId,
          afterId: node.id,
          data: newTextModel,
        },
      ];

      this.applyActions(actions);
      this.render(() => {
        this.state.cursorState = {
          type: "collapsed",
          targetId: newId,
          offset: 0,
        };
      });
    } else {
      console.error("unhandled");
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

    const node = this.state.idMap.get(targetId);
    if (!node) {
      return false;
    }
    const prevNode = node.prev;

    const blockDef = this.registry.block.getBlockDefById(node.blockTypeId)!;

    if (blockDef.editable !== false) {
      return false;
    }

    this.applyActions([{
      type: "delete",
      targetId,
    }]);
    this.render(() => {
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
    });
    return true;
  }

  private focusEndOfNode(treeNode: TreeNode) {
    const { data } = treeNode;
    if (data && data instanceof TextModel) {
      const length = data.length;
      this.state.cursorState = {
        type: "collapsed",
        targetId: treeNode.id,
        offset: length,
      };
    } else {
      this.state.cursorState = {
        type: "collapsed",
        targetId: treeNode.id,
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

    if (!newState) {
      sel.removeAllRanges();
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
    const node = blockDom._mgNode as TreeNode | undefined
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
      const blockDef = blockRegistry.getBlockDefByName("text");
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
       return this.insertBlockByDefaultAt(cursorState, "text");
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

    const currentNode = this.state.idMap.get(cursorState.targetId)!;
    const parentId = currentNode.parent!.id;

    const newId = this.idGenerator.mkBlockId();

    let data: any;
    if (blockName === "text") {
      data = new TextModel;
    }

    this.applyActions([{
      type: "new-block",
      targetId: parentId,
      afterId: cursorState.targetId,
      newId,
      blockName,
      data,
    }]);

    return {
      type: "collapsed",
      targetId: newId,
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

    const textModel = this.getTextModelByBlockId(cursorState.targetId);
    if (!textModel) {
      return;
    }

    const afterOffset = cursorState.offset + text.length;
    textModel.insert(cursorState.offset, text, attributes);
    return {
      type: "collapsed",
      targetId: cursorState.targetId,
      offset: afterOffset
    };
  }

  getTextModelByBlockId(blockId: string): TextModel | undefined {
    const treeNode = this.state.idMap.get(blockId);
    if (!treeNode) {
      return;
    }

    const treeData = treeNode.data;

    if (treeData && treeData instanceof TextModel) {
      return treeData;
    }
  }

  dispose() {
    document.removeEventListener("selectionchange", this.selectionChanged);
    flattenDisposable(this.disposables).dispose();
  }
}
