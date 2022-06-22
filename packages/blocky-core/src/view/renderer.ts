import { clearAllChildren, elem, removeNode } from "blocky-common/es/dom";
import { type TreeNode } from "@pkg/model";
import type { Editor } from "@pkg/view/editor";
import { type IBlockDefinition } from "@pkg/block/basic";

function ensureChild<K extends keyof HTMLElementTagNameMap>(
  dom: HTMLElement,
  index: number,
  tag: K,
  cls?: string,
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
      state.domMap.set(state.root.id, newDom);
      return newDom;
    }

    if (oldDom && oldDom instanceof HTMLDivElement) {
      this.renderDocument(state.root, oldDom);
      return oldDom;
    } else {
      return createNewDocument();
    }
  }

  protected renderDocument(model: TreeNode, dom: HTMLDivElement) {
    dom._mgNode = model;

    const { clsPrefix } = this;
    const blocksContainer = ensureChild(dom, 0, "div", `${clsPrefix}-editor-blocks-container`);
    this.renderBlocks(blocksContainer, model);
  }

  protected createBlockContainer() {
    return elem("div", this.blockClassName);
  }

  protected renderBlocks(blocksContainer: HTMLElement, parentNode: TreeNode) {
    let nodePtr = parentNode.firstChild;
    
    if (!nodePtr) {
      clearAllChildren(blocksContainer);
      return;
    }

    let domPtr: Node | null = blocksContainer.firstChild;
    let prevPtr: Node | undefined;

    while (nodePtr) {
      const id = nodePtr.id;
      const blockDef = this.editor.registry.block.getBlockDefById(nodePtr.blockTypeId);

      if (!blockDef) {
        throw new Error(`id not found: ${nodePtr.blockTypeId}`);
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
          this.initBlockContainer(newBlockContainer, nodePtr, blockDef);
        }
      }

      const block = this.editor.state.blocks.get(id)!;
      block.render(domPtr as HTMLElement);

      nodePtr = nodePtr.next;
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

  private initBlockContainer(blockContainer: HTMLElement, blockNode: TreeNode, blockDef: IBlockDefinition) {
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
