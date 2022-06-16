import { $on, removeNode } from "blocky-common/es/dom";
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
  type DocNode,
  type BlockData,
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
    });
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

  private findBlockNodeContainer(node: Node): TreeNode<BlockData> | undefined {
    let ptr: Node | null = node;

    while (ptr) {
      const node = ptr._mgNode as TreeNode<DocNode> | undefined;
      if (node && node.data.t === "block") {
        return node as TreeNode<BlockData>;
      }

      ptr = ptr.parentNode;
    }

    return;
  }
  
  private findTextOffsetInBlock(blockNode: TreeNode<BlockData>, focusedNode: Node, offsetInNode: number): number {
    const { data } = blockNode;
    const block = this.state.blocks.get(data.id)!;

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
    if (data.t === "block") {
      this.checkBlockContent(node, treeNode, currentOffset);
    }
  }

  /**
   * Check if there is new span created by the browser
   */
  private checkBlockContent(
    node: Node,
    blockNode: TreeNode<DocNode>,
    currentOffset?: number,
  ) {
    const blockData = blockNode.data as BlockData;
    const block = this.state.blocks.get(blockData.id)!;

    block.blockContentChanged({
      node: node as HTMLDivElement,
      offset: currentOffset,
    });
  }

  private checkNodesChanged(actions: Action[]) {
    console.log("check nodes changed");
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
        const blockData = data as BlockData;
        const block = this.state.blocks.get(blockData.id);
        block?.dispose();
        this.state.blocks.delete(blockData.id);
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

      const lineNode = node.parent?.parent;
      if (!lineNode) {
        return;
      }

      const parentNode = lineNode.parent;
      if (!parentNode) {
        return;
      }

      const cursorOffset = cursorState.offset;

      const actions: Action[] = [
        {
          type: "new-block",
          blockName: TextBlockName,
          targetId: parentNode.data.id,
          newId: this.idGenerator.mkBlockId(),
          afterId: lineNode.data.id,
        },
      ];


      removeNodesAfter(node, actions);
      this.applyActions(actions);
      this.render(() => {
        // if (remain.length > 0) {
        //   const firstSpan = remain[0];
        //   this.state.cursorState = {
        //     type: "collapsed",
        //     targetId: firstSpan.id,
        //     offset: 0,
        //   };
        // }
      });
    } else {
      console.error("unhandled");
    }
  }

  private handleDelete(e: KeyboardEvent) {
    e.preventDefault();
  }

  private handleBackspace(e: KeyboardEvent) {
    // const { cursorState } = this.state;
    // if (!cursorState) {
    //   return;
    // }
    // if (cursorState.type === "open") {
    //   return;
    // }
    // const { targetId, offset } = cursorState;
    // const node = this.state.idMap.get(targetId);
    // if (!node) {
    //   return;
    // }
    // if (offset === 0) {
    //   // at the beginning of a line
    //   e.preventDefault();
    //   this.tryBackDeleteThisLine(node);
    //   return;
    // }
  }

  public handleCursorStateChanged = (
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
    const node = blockDom._mgNode as TreeNode<DocNode> | undefined
    if (!node) {
      return;
    }

    const block = this.state.blocks.get(node.data.id)!;
    block.blockFocused({ node: blockDom, cursor, selection: sel });
  }

  private handlePaste = (e: ClipboardEvent) => {
    e.preventDefault();
  };

  dispose() {
    document.removeEventListener("selectionchange", this.selectionChanged);
    flattenDisposable(this.disposables).dispose();
  }
}
