import { $on, removeNode } from "blocky-common/es/dom";
import { observe, runInAction } from "blocky-common/es/observable";
import { Slot } from "blocky-common/es/events";
import {
  type IDisposable,
  flattenDisposable,
} from "blocky-common/es/disposable";
import { lazy } from "blocky-common/es/lazy";
import { type Position } from "blocky-common/es/position";
import { DocRenderer } from "@pkg/view/renderer";
import {
  State as DocumentState,
  type TreeNode,
  type DocNode,
  type Span,
  type Block,
} from "@pkg/model/index";
import { CollapsedCursor, type CursorState } from "@pkg/model/cursor";
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
import fastdiff from "fast-diff";

const arrowKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function removeNodesAfter(node: TreeNode<DocNode>, actions: Action[]) {
  let ptr = node.next;
  while (ptr) {
    actions.push({
      type: "delete",
      targetId: ptr.data.id,
    });
    ptr = ptr.next;
  }
}

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

/**
 * The spans created by the browser
 */
interface NewSpanTuple {
  node: Node;
  id: string;
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
  public readonly bannerDelegate: BannerDelegate;
  public readonly toolbarDelegate: ToolbarDelegate;
  public idGenerator: IdGenerator;

  public readonly state: DocumentState;
  public readonly registry: EditorRegistry;
  public readonly keyUp = new Slot<KeyboardEvent>();
  public readonly keyDown = new Slot<KeyboardEvent>();

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
      registry: this.registry,
    });
  }

  public applyStyleOnTextRange(styleName: string, startId: string, startOffset: number, endId: string, endOffset: number) {
    if (startId !== endId) {
      console.error("unimplemented: apply style crossing blocks");
      return;
    }

    const spanId = this.registry.span.getSpanIdByName(styleName)!;

    const actions: Action[] = [];

    this.state.applyActions(actions);
  }

  public render(done?: AfterFn) {
    console.log("render");
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
  }

  private getTreeNodeFromDom(node: Node): TreeNode<DocNode> | undefined {
    if (node._mgNode) {
      return node._mgNode;
    }

    if (node instanceof Text && node.parentNode instanceof HTMLSpanElement) {
      const parent = node.parentNode;
      if (parent._mgNode) {
        return parent._mgNode;
      }
    }
  }

  private trySelectOnParent(startContainer: Node): boolean {
    const parent = startContainer.parentNode;
    if (!parent) {
      return false;
    }

    // parent is block
    if (parent instanceof HTMLElement && parent.classList.contains(this.#renderer.blockClassName)) {
      const node = parent._mgNode as TreeNode<DocNode> | undefined;
      if (!node) {
        return false;
      }

      this.state.cursorState = {
        type: "collapsed",
        targetId: node.data.id,
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

  private findBlockNodeContainer(node: Node): TreeNode<Block> | undefined {
    let ptr: Node | null = node;

    while (ptr) {
      const node = ptr._mgNode as TreeNode<DocNode> | undefined;
      if (node && node.data.t === "block") {
        return node as TreeNode<Block>;
      }

      ptr = ptr.parentNode;
    }

    return;
  }
  
  private findTextOffsetInBlock(blockNode: TreeNode<Block>, focusedNode: Node, offsetInNode: number): number {
    const { data } = blockNode;
    const blockDef = this.registry.block.getBlockDefById(data.flags)!;
    if (!blockDef.editable) {
      return 0;
    }
    const blockContainer = this.state.domMap.get(data.id)!;
    const contentContainer = blockDef.findContentContainer!(blockContainer as HTMLElement);
    let counter = 0;
    let ptr = contentContainer.firstChild;

    while (ptr) {
      if (ptr === focusedNode) {
        break;
      }
      counter += ptr.textContent?.length ?? 0;
      ptr = ptr.nextSibling;
    }

    return counter + offsetInNode;
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
        targetId: startNode.data.id,
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
        startId: startNode.data.id,
        startOffset: absoluteStartOffset,
        endId: endNode.data.id,
        endOffset: absoluteEndOffset,
      };
    }
    console.log("selection:", this.state.cursorState);

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
    const rect = range.getBoundingClientRect();

    const x = rect.x - containerRect.x;
    const y = rect.y - containerRect.y - rect.height - 12;

    this.toolbarDelegate.setPosition(x, y);

    return true;
  }

  private checkMarkedDom(
    node: Node,
    actions: Action[],
    currentOffset?: number,
    newSpanTuples?: NewSpanTuple[]
  ) {
    const treeNode = node._mgNode as TreeNode<DocNode>;
    if (!node.parentNode) {
      // dom has been removed

      this.destructBlockNode(node);
      actions.push({
        type: "delete",
        targetId: treeNode.data.id,
      });
      return;
    }

    const { data } = treeNode;
    if (data.t === "span") {
      const { content, id } = data;
      const currentContent = node.textContent || "";
      if (content !== currentContent) {
        actions.push({
          type: "update-span",
          targetId: id,
          value: { content: currentContent },
          get diffs() {
            return lazy(() => {
              return fastdiff(content, currentContent, currentOffset);
            })();
          },
        });
      }
    } else if (data.t === "block") {
      this.checkBlockContent(node, treeNode, actions, newSpanTuples);
    }
  }

  /**
   * Check if there is new span created by the browser
   */
  private checkBlockContent(
    node: Node,
    lineNode: TreeNode<DocNode>,
    actions: Action[],
    newSpans?: NewSpanTuple[]
  ) {
    const contentContainer = node.firstChild! as HTMLElement;

    let prevId: string | undefined;

    let ptr = contentContainer.firstChild;

    const nodesToRemoved: Node[] = [];

    while (ptr) {
      if (ptr instanceof Text) {
        if (ptr._mgNode) {
          const node = ptr._mgNode as TreeNode<DocNode>;
          prevId = node.data.id;
        } else {
          // add a new node
          const newId = this.idGenerator.mkSpanId();
          actions.push({
            type: "new-span",
            targetId: lineNode.data.id,
            afterId: prevId,
            content: {
              id: newId,
              t: "span",
              flags: 0,
              content: ptr.textContent || "",
            },
          });
          prevId = newId;
          newSpans?.push({
            node: ptr,
            id: newId,
          });
        }
      } else if (ptr instanceof HTMLSpanElement) {
        if (ptr._mgNode) {
          const node = ptr._mgNode as TreeNode<DocNode>;
          prevId = node.data.id;
        } else {
          // add a new node
          const newId = this.idGenerator.mkSpanId();
          const dataType = parseInt(ptr.getAttribute("data-type") || "0", 0);
          actions.push({
            type: "new-span",
            targetId: lineNode.data.id,
            afterId: prevId,
            content: {
              id: newId,
              t: "span",
              flags: dataType,
              content: ptr.textContent || "",
            },
          });
          prevId = newId;
          newSpans?.push({
            node: ptr,
            id: newId,
          });
        }
      } else {
        nodesToRemoved.push(ptr);
      }

      ptr = ptr.nextSibling;
    }

    nodesToRemoved.forEach((node) => node.parentNode?.removeChild(node));
  }

  private checkNodesChanged(actions: Action[], newSpanTuples: NewSpanTuple[]) {
    console.log("check nodes changed");
    const doms = this.state.domMap.values();
    for (const dom of doms) {
      this.checkMarkedDom(dom, actions, undefined, newSpanTuples);
    }
  }

  private handleOpenCursorContentChanged() {
    const actions: Action[] = [];
    const newSpanTuples: NewSpanTuple[] = [];
    this.checkNodesChanged(actions, newSpanTuples);
    this.applyActions(actions);
    this.bindNewSpansTuples(newSpanTuples);
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
    const newSpanTuples: NewSpanTuple[] = [];

    this.checkMarkedDom(domNode, actions, currentOffset, newSpanTuples);
    this.applyActions(actions, true);
    this.bindNewSpansTuples(newSpanTuples);
  };

  private bindNewSpansTuples(tuples: NewSpanTuple[]) {
    tuples.forEach((tuple) => this.bindNewSpanTuple(tuple));
  }

  private bindNewSpanTuple({ node, id }: NewSpanTuple) {
    const treeNode = this.state.idMap.get(id);
    if (!treeNode) {
      throw new Error(`${id} is not created successfully`);
    }
    node._mgNode = treeNode;
    this.state.domMap.set(id, node);
  }

  public applyActions(actions: Action[], noUpdate: boolean = false) {
    if (actions.length === 0) {
      return;
    }

    console.log("apply:", actions);
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

  public placeBannerAt(blockContainer: HTMLElement, node: TreeNode<DocNode>) {
    const { y } = this.getRelativeOffsetByDom(blockContainer);

    this.bannerDelegate.focusedNode = node;
    this.bannerDelegate.show();
    this.bannerDelegate.setPosition(24, y + 2);
  }

  /**
   * Remove node and call the destructor
   */
  public destructBlockNode(node: Node) {
    if (node._mgNode) {
      const treeNode = node._mgNode as TreeNode<DocNode>;
      const data = treeNode.data;

      if (data.t === "block") {
        const block = data as Block;
        const blockType = block.flags;
        const blockDef = this.registry.block.getBlockDefById(blockType);
        blockDef?.blockWillUnmount?.(node as HTMLElement);
      }

      this.state.domMap.delete(data.id);
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
    } else if (e.key === "ArrowUp") {
      this.keyUp.emit(e);
    } else if (e.key === "ArrowDown") {
      this.keyDown.emit(e);
    } else if (e.key === "Delete") {
      this.handleDelete(e);
    }
  };

  private handleKeyTab(e: KeyboardEvent) {
    e.preventDefault();
  }

  private sliceSpanNode(spanNode: TreeNode<DocNode>, offset: number): Span[] {
    const result: Span[] = [];

    let ptr: TreeNode<DocNode> | undefined = spanNode;

    while (ptr) {
      if (ptr.data.t === "span") {
        result.push({
          ...ptr.data,
          id: this.idGenerator.mkSpanId(),
        });
      }
      ptr = ptr.next;
    }

    if (result.length > 0) {
      result[0].content = result[0].content.slice(offset);
    }

    return result;
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

      const { data } = node;
      if (data.t !== "span") {
        return;
      }

      const lineNode = node.parent?.parent;
      if (!lineNode) {
        return;
      }

      const parentNode = lineNode.parent;
      if (!parentNode) {
        return;
      }

      const cursorOffset = cursorState.offset;
      const remain: Span[] = this.sliceSpanNode(node, cursorOffset);

      const actions: Action[] = [
        {
          type: "new-block",
          blockName: TextBlockName,
          targetId: parentNode.data.id,
          newId: this.idGenerator.mkBlockId(),
          afterId: lineNode.data.id,
          spans: remain,
        },
      ];

      if (cursorOffset < data.content.length) {
        const before = data.content.slice(0, cursorOffset);
        actions.push({
          type: "update-span",
          targetId: node.data.id,
          value: {
            content: before,
          },
        });
      }

      removeNodesAfter(node, actions);
      this.applyActions(actions);
      this.render(() => {
        if (remain.length > 0) {
          const firstSpan = remain[0];
          this.state.cursorState = {
            type: "collapsed",
            targetId: firstSpan.id,
            offset: 0,
          };
        }
      });
    } else {
      console.error("unhandled");
    }
  }

  private handleDelete(e: KeyboardEvent) {
    e.preventDefault();
  }

  private handleBackspace(e: KeyboardEvent) {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.type === "open") {
      return;
    }
    const { targetId, offset } = cursorState;
    const node = this.state.idMap.get(targetId);
    if (!node) {
      return;
    }
    const { data } = node;
    if (data.t !== "span") {
      return;
    }
    if (offset === 0) {
      // at the beginning of a line
      e.preventDefault();
      this.tryBackDeleteThisLine(node);
      return;
    }
  }

  // private normalizeLine(lineNode: TreeNode<DocNode>) {
  //   const actions: Action[] = [];
  //   normalizeLine(lineNode, actions);
  //   console.log("normalize action", actions);
  //   this.applyActions(actions);
  // }

  // return the first id of new spans
  private pushingSpansToPreviousLine(
    spanNode: TreeNode<DocNode>,
    prevLineNode: TreeNode<DocNode>,
    actions: Action[]
  ): string | undefined {
    const lineId = prevLineNode.data.id;
    const lastNodeOfPrevLine = prevLineNode.firstChild!.lastChild as
      | TreeNode<Span>
      | undefined;

    let afterId = lastNodeOfPrevLine?.data.id;

    let ptr = spanNode as TreeNode<Span> | undefined;

    // merge the first one if the flags are equal
    if (
      lastNodeOfPrevLine &&
      ptr &&
      ptr.data.flags === lastNodeOfPrevLine.data.flags
    ) {
      const content = lastNodeOfPrevLine.data.content + ptr.data.content;
      actions.push({
        type: "update-span",
        targetId: lastNodeOfPrevLine.data.id,
        value: { content },
      });
      ptr = ptr.next;
    }

    let firstId: string | undefined;
    while (ptr) {
      const currentSpan = ptr.data as Span;
      if (currentSpan.content.length > 0) {
        const newId = this.idGenerator.mkSpanId();
        if (!firstId) {
          firstId = newId;
        }
        actions.push({
          type: "new-span",
          targetId: lineId,
          afterId,
          content: {
            t: "span",
            id: newId,
            content: currentSpan.content,
            flags: currentSpan.flags,
          },
        });
        afterId = newId;
      }

      ptr = ptr.next;
    }

    return firstId;
  }

  private tryDeleteLineOfSpan(spanNode: TreeNode<DocNode>) {
    const lineNode = spanNode.parent!.parent!;

    const prevLineNode = lineNode.prev;
    if (!prevLineNode) {
      // it's the first line
      return;
    }

    const lineId = lineNode.data.id;

    const actions: Action[] = [
      {
        type: "delete",
        targetId: lineId,
      },
    ];

    // TODO: handle offset
    const firstId = this.pushingSpansToPreviousLine(
      spanNode,
      prevLineNode,
      actions
    );

    this.applyActions(actions);

    this.render(() => {
      if (firstId) {
        this.state.cursorState = {
          type: "collapsed",
          targetId: firstId,
          offset: 0,
        };
      } else {
        const lastSpan = prevLineNode.firstChild?.lastChild;
        if (!lastSpan) {
          this.state.cursorState = undefined;
          return;
        }

        const lastSpanData = lastSpan.data as Span;
        this.state.cursorState = {
          type: "collapsed",
          targetId: lastSpanData.id,
          offset: lastSpanData.content.length,
        };
      }
    });
  }

  private tryBackDeleteThisLine(spanNode: TreeNode<DocNode>) {
    if (spanNode.data.t !== "span") {
      return;
    }

    const { prev } = spanNode;
    if (!prev) {
      this.tryDeleteLineOfSpan(spanNode);
      return;
    }
  }

  private handleCursorStateChanged = (
    newState: CursorState | undefined,
    oldState: CursorState | undefined
  ) => {
    if (areEqualShallow(newState, oldState)) {
      return;
    }

    console.log("new cursor state: ", newState, oldState);

    const sel = window.getSelection();
    if (!sel) {
      return;
    }

    if (!newState) {
      sel.removeAllRanges();
      return;
    }

    if (newState.type === "open") {
      return;
    }

    const { targetId } = newState;

    const targetNode = this.state.domMap.get(targetId);
    if (!targetNode) {
      throw new Error(`dom not found: ${targetId}`);
    }

    if (
      targetNode instanceof HTMLDivElement &&
      targetNode.classList.contains(this.#renderer.blockClassName)
    ) {
      this.focusBlock(sel, targetNode, newState);
    } else {
      console.error("unknown element:", targetNode);
    }
  };

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
    const dataType = blockDom.getAttribute("data-type") || "";
    const blockDef = this.registry.block.getBlockDefByName(dataType);
    if (!blockDef) {
      return;
    }

    blockDef.onBlockFocused?.({ node: blockDom, cursor, selection: sel });
  }

  private handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
  };

  dispose() {
    document.removeEventListener("selectionchange", this.selectionChanged);
    flattenDisposable(this.disposables).dispose();
  }
}
