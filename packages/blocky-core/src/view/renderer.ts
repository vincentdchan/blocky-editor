import { elem, removeNode } from "blocky-common/es/dom";
import { isUndefined } from "lodash-es";
import { type IBlockDefinition } from "@pkg/block/basic";
import {
  type BlockyDocument,
  type DataBaseNode,
  BlockDataElement,
  BlockyTextModel,
  FinalizedChangeset,
  Operation,
} from "@pkg/data";
import type { Editor } from "@pkg/view/editor";
import { TextBlock } from "@pkg/block/textBlock";

function ensureChild<K extends keyof HTMLElementTagNameMap>(
  dom: HTMLElement,
  index: number,
  tag: K,
  cls?: string,
  creator?: (element: HTMLElement) => void
): HTMLElement {
  const item = dom.children.item(index);
  if (
    item === null ||
    item.tagName.toLowerCase() !== tag ||
    item.className != cls
  ) {
    const newItem = elem(tag, cls);
    if (item === null) {
      dom.appendChild(newItem);
    } else {
      dom.insertBefore(newItem, item);
    }
    creator?.(newItem);
    return newItem;
  }
  return item as HTMLElement;
}

interface IRendererOptions {
  clsPrefix: string;
  editor: Editor;
}

export enum RenderFlag {
  Full = 0x01,
  Incremental = 0x02,
}

export interface RenderOption {
  changeset?: FinalizedChangeset;
  operation?: Operation;
  flags: number;
}

function isChangesetAllTextEdit(changeset: FinalizedChangeset): boolean {
  for (let i = 0, len = changeset.operations.length; i < len; i++) {
    if (changeset.operations[i].op !== "text-edit") {
      return false;
    }
  }

  return true;
}

/**
 * Generally, the renderer only needs to
 * call the render method of the block.
 *
 * But there are still some cases where
 * the renderer needs to do some extra work
 * such as number list.
 *
 * The renderer needs to know the global status
 * of the number list, so it needs to be
 * implemented in the renderer.
 */
export class DocRenderer {
  private clsPrefix: string;
  private editor: Editor;

  readonly blockClassName: string;

  constructor({ clsPrefix, editor }: IRendererOptions) {
    this.clsPrefix = clsPrefix;
    this.editor = editor;

    this.blockClassName = `${clsPrefix}-editor-block`;
  }

  render(option: RenderOption, oldDom?: Node) {
    const { editor, clsPrefix } = this;
    const { state } = editor;
    const createNewDocument = () => {
      const newDom = elem(
        "div",
        `${clsPrefix}-documents ${clsPrefix}-default-fonts`
      );
      this.renderDocument(option, state.document, newDom);
      return newDom;
    };

    if (oldDom && oldDom instanceof HTMLDivElement) {
      const { changeset } = option;
      if (
        option.flags === RenderFlag.Incremental &&
        changeset &&
        isChangesetAllTextEdit(changeset)
      ) {
        for (let i = 0, len = changeset.operations.length; i < len; i++) {
          const op = changeset.operations[i];
          this.renderTextBlockByOperation(changeset, op);
        }

        return oldDom;
      }

      this.renderDocument(option, state.document, oldDom);
      return oldDom;
    } else {
      return createNewDocument();
    }
  }

  renderTextBlockByOperation(
    changeset: FinalizedChangeset,
    operation: Operation
  ) {
    if (operation.op !== "text-edit") {
      throw new Error("op error:" + operation.op);
    }
    const state = this.editor.state;
    const blockElement = state.getBlockElementById(operation.id);
    if (!blockElement) {
      // has been deleted?
      return;
    }
    if (blockElement.t !== TextBlock.Name) {
      return;
    }
    const block = state.blocks.get(operation.id);
    const dom = state.domMap.get(operation.id);
    if (block && dom) {
      block.render?.(dom as HTMLElement, {
        changeset,
        operation,
        flags: RenderFlag.Incremental,
      });
    }
  }

  protected renderDocument(
    option: RenderOption,
    document: BlockyDocument,
    dom: HTMLDivElement
  ) {
    dom._mgNode = document;

    const { clsPrefix } = this;
    let renderCounter = 0;
    if (document.title) {
      const titleContainer = ensureChild(
        dom,
        renderCounter++,
        "div",
        `${clsPrefix}-editor-title-container ${this.blockClassName}`,
        (elem: HTMLElement) => {
          const { padding } = this.editor;
          const { right, left } = padding;
          elem.style.paddingLeft = `${left}px`;
          elem.style.paddingRight = `${right}px`;

          if (this.editor.controller?.options?.titleEditable === false) {
            elem.contentEditable = "false";
          }
        }
      );
      this.renderTitle(titleContainer, document.title as BlockDataElement);
    }
    const blocksContainer = ensureChild(
      dom,
      renderCounter++,
      "div",
      `${clsPrefix}-editor-blocks-container`,
      (elem: HTMLElement) => {
        const { padding } = this.editor;
        const { top, right, bottom, left } = padding;
        elem.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
      }
    );
    this.renderBlocks(
      option,
      blocksContainer,
      blocksContainer.firstChild,
      document.body.firstChild
    );
  }

  protected renderTitle(dom: HTMLElement, titleElement: BlockDataElement) {
    if (isUndefined(dom._mgNode)) {
      dom._mgNode = titleElement;
      const block = this.editor.state.blocks.get(titleElement.id)!;
      block.blockDidMount?.({
        clsPrefix: this.clsPrefix,
        blockDef: null as any,
        element: dom,
        blockElement: titleElement,
      });
      this.editor.state.domMap.set(titleElement.id, dom);
    }
    const title = titleElement.getAttribute("textContent");
    if (title instanceof BlockyTextModel) {
      const titleStr = title.toString();
      if (dom.innerText !== titleStr) {
        dom.innerText = titleStr;
      }
    } else {
      if (dom.innerText !== "") {
        dom.innerText = "";
      }
    }
  }

  protected createBlockContainer() {
    return elem("div", this.blockClassName);
  }

  #clearDeletedBlock(dom: Node | null): Node | null {
    while (dom?._mgNode) {
      const treeNode = dom?._mgNode as BlockDataElement;
      const id = treeNode.id;
      if (!this.editor.state.containsBlockElement(id)) {
        const next = dom.nextSibling;
        removeNode(dom);
        dom = next;
      } else {
        break;
      }
    }

    return dom;
  }

  protected renderBlocks(
    option: RenderOption,
    blocksContainer: HTMLElement,
    beginChild: ChildNode | null,
    beginBlockyNode: DataBaseNode | null
  ) {
    let nodePtr = beginBlockyNode;

    // remove the following node;
    if (!nodePtr) {
      let next = beginChild?.nextSibling;
      while (next) {
        const nextOfNext = next.nextSibling;
        removeNode(next);
        next = nextOfNext;
      }
      return;
    }

    let domPtr: Node | null = beginChild;
    let prevPtr: Node | undefined;

    while (nodePtr) {
      if (!(nodePtr instanceof BlockDataElement)) {
        // skip this element
        nodePtr = nodePtr.nextSibling;
        continue;
      }
      const blockElement = nodePtr as BlockDataElement;
      const id = blockElement.id;
      const blockDef = this.editor.registry.block.getBlockDefByName(
        blockElement.t
      );
      domPtr = this.#clearDeletedBlock(domPtr);

      if (!blockDef) {
        throw new Error(`id not found: ${blockElement.t}`);
      }

      if (
        !domPtr ||
        isUndefined(domPtr._mgNode) ||
        domPtr._mgNode !== nodePtr
      ) {
        const existDom = this.editor.state.domMap.get(id);
        if (existDom) {
          // move dom from another place
          // don't need to destruct
          // maybe used later
          removeNode(existDom);
          blocksContainer.insertBefore(existDom, prevPtr?.nextSibling ?? null);
          domPtr = existDom;
        } else {
          const newBlockContainer = this.createBlockContainer();
          newBlockContainer.setAttribute("data-id", blockElement.id);
          blocksContainer.insertBefore(
            newBlockContainer,
            prevPtr?.nextSibling ?? null
          );
          domPtr = newBlockContainer;
          this.#initBlockContainer(newBlockContainer, blockElement, blockDef);
        }
      }

      const block = this.editor.state.blocks.get(id);
      if (!block) {
        throw new Error(`block not found for id: ${id}`);
      }
      block.render?.(domPtr as HTMLElement, option);

      nodePtr = nodePtr.nextSibling;
      prevPtr = domPtr;
      domPtr = domPtr.nextSibling;

      const childrenBeginElement = block.renderChildren?.();
      if (childrenBeginElement) {
        const { childrenContainerDOM, childrenBeginDOM } = block;
        if (childrenContainerDOM) {
          this.renderBlocks(
            option,
            childrenContainerDOM,
            childrenBeginDOM,
            childrenBeginElement
          );
        }
      }
    }

    // domPtr is not null
    while (domPtr) {
      const next = domPtr.nextSibling;

      removeNode(domPtr);

      domPtr = next;
    }
  }

  #initBlockContainer(
    blockContainer: HTMLElement,
    blockNode: BlockDataElement,
    blockDef: IBlockDefinition
  ) {
    const { editor, clsPrefix } = this;

    blockContainer._mgNode = blockNode;
    editor.state.setDom(blockNode.id, blockContainer);
    blockContainer.setAttribute("data-type", blockDef.Name);
    blockContainer.addEventListener("mouseenter", () => {
      editor.placeSpannerAt(blockContainer, blockNode);
    });

    const block = editor.state.blocks.get(blockNode.id);
    if (!block) {
      throw new Error(`block not found: ${blockNode.id}`);
    }
    block.blockDidMount?.({
      element: blockContainer,
      blockDef,
      blockElement: blockNode,
      clsPrefix,
    });

    block.dragOver$.subscribe((e) => {
      e.preventDefault();
    });
    block.drop$.subscribe((e) => {
      e.preventDefault();
    });
  }

  protected typeOfDomNode(node: Node): number | undefined {
    const { editor } = this;
    if (node instanceof Text) {
      return 0;
    } else if (node instanceof HTMLSpanElement) {
      const tyName = node.getAttribute("data-type") || "";
      return editor.registry.block.getBlockIdByName(tyName);
    }
    return undefined;
  }
}
