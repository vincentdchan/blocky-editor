import { clearAllChildren, elem, removeNode } from "blocky-common/es/dom";
import { type BlockyElement } from "@pkg/model";
import type { Editor } from "@pkg/view/editor";
import { type BlockElement, type IBlockDefinition } from "@pkg/block/basic";

function ensureChild<K extends keyof HTMLElementTagNameMap>(
  dom: HTMLElement,
  index: number,
  tag: K,
  cls?: string,
  creator?: (element: HTMLElement) => void,
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

export class DocRenderer {
  private clsPrefix: string;
  private editor: Editor;

  public readonly blockClassName: string;

  constructor({ clsPrefix, editor }: IRendererOptions) {
    this.clsPrefix = clsPrefix;
    this.editor = editor;

    this.blockClassName = `${clsPrefix}-editor-block`;
  }

  public render(oldDom?: Node) {
    const { editor, clsPrefix } = this;
    const { state } = editor;
    const createNewDocument = () => {
      const newDom = elem("div", `${clsPrefix}-documents ${clsPrefix}-default-fonts`);
      this.renderDocument(state.root, newDom);
      return newDom;
    }

    if (oldDom && oldDom instanceof HTMLDivElement) {
      this.renderDocument(state.root, oldDom);
      return oldDom;
    } else {
      return createNewDocument();
    }
  }

  protected renderDocument(model: BlockyElement, dom: HTMLDivElement) {
    dom._mgNode = model;

    const { clsPrefix } = this;
    const blocksContainer = ensureChild(dom, 0, "div", `${clsPrefix}-editor-blocks-container`, (elem: HTMLElement) => {
      const { padding } = this.editor;
      const { top, right, bottom, left } = padding;
      elem.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
    });
    this.renderBlocks(blocksContainer, model);
  }

  protected createBlockContainer() {
    return elem("div", this.blockClassName);
  }

  private clearDeletedBlock(dom: Node | null): Node | null {
    while (dom?._mgNode) {
      const treeNode = dom?._mgNode as BlockElement;
      const id = treeNode.id;
      if (!this.editor.state.idMap.has(id)) {
        const next = dom.nextSibling;
        removeNode(dom);
        dom = next;
      } else {
        break;
      }
    }

    return dom;
  }

  protected renderBlocks(blocksContainer: HTMLElement, parentNode: BlockyElement) {
    let nodePtr = parentNode.firstChild;
    
    if (!nodePtr) {
      clearAllChildren(blocksContainer);
      return;
    }

    let domPtr: Node | null = blocksContainer.firstChild;
    let prevPtr: Node | undefined;

    while (nodePtr) {
      const blockElement = nodePtr as BlockElement;
      const id = blockElement.id;
      const blockDef = this.editor.registry.block.getBlockDefByName(blockElement.blockName);
      domPtr = this.clearDeletedBlock(domPtr);

      if (!blockDef) {
        throw new Error(`id not found: ${blockElement.blockName}`);
      }

      if (!domPtr || typeof domPtr._mgNode === "undefined" || domPtr._mgNode !== nodePtr) {
        const existDom = this.editor.state.domMap.get(id);
        if (existDom) {  // move dom from another place
          // don't need to destruct
          // maybe used later
          removeNode(existDom);
          blocksContainer.insertBefore(existDom, prevPtr?.nextSibling ?? null);
          domPtr = existDom;
        } else {
          const newBlockContainer = this.createBlockContainer();
          blocksContainer.insertBefore(newBlockContainer, prevPtr?.nextSibling ?? null);
          domPtr = newBlockContainer;
          this.initBlockContainer(newBlockContainer, blockElement, blockDef);
        }
      }

      const block = this.editor.state.blocks.get(id)!;
      block.render(domPtr as HTMLElement);

      nodePtr = nodePtr.nextSibling;
      prevPtr = domPtr;
      domPtr = domPtr.nextSibling;
    }

    // domPtr is not null
    while (domPtr) {
      let next = domPtr.nextSibling;

      this.editor.destructBlockNode(domPtr);

      domPtr = next;
    }
  }

  private initBlockContainer(blockContainer: HTMLElement, blockNode: BlockElement, blockDef: IBlockDefinition) {
    const { editor, clsPrefix } = this;

    if (!blockDef.editable) {
      blockContainer.contentEditable = "false";
    }

    blockContainer._mgNode = blockNode;
    editor.state.domMap.set(blockNode.id, blockContainer);
    blockContainer.setAttribute("data-type", blockDef.name);
    blockContainer.addEventListener("mouseenter", () => {
      editor.placeBannerAt(blockContainer, blockNode);
    });

    const block = editor.state.blocks.get(blockNode.id)!;
    block.blockDidMount({
      element: blockContainer,
      clsPrefix,
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
