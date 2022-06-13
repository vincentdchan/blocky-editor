import { clearAllChildren, elem, removeNode } from "blocky-common/es/dom";
import {
  type Block,
  type TreeNode,
  type Span,
  type DocNode,
  treeChildrenToArray,
} from "@pkg/model/index";
import type { Editor, EditorRegistry } from "@pkg/view/editor";
import type { ISpanType } from "@pkg/registry/spanRegistry";
import { BlockContentType, IBlockDefinition } from "..";

function createSpanNode(
  spanNode: TreeNode<Span>,
  spanDef: ISpanType
): Node {
  const { data } = spanNode;
  const spanType = data.flags;
  if (spanType === 0) {
    const result = document.createTextNode(data.content);
    return result;
  }

  const result = elem("span");

  if (spanDef.classNames) {
    for (const cls of spanDef.classNames) {
      result.classList.add(cls);
    }
  }

  result.setAttribute("data-type", spanType.toString());
  result.textContent = data.content;

  return result;
}

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
  registry: EditorRegistry;
}

export class DocRenderer {
  private clsPrefix: string;
  private editor: Editor;
  private registry: EditorRegistry;

  public readonly blockClassName: string;

  constructor({ clsPrefix, editor, registry }: IRendererOptions) {
    this.clsPrefix = clsPrefix;
    this.editor = editor;
    this.registry = registry;

    this.blockClassName = `${clsPrefix}-editor-block`;
  }

  public render(oldDom?: Node) {
    const { editor, clsPrefix } = this;
    const { state } = editor;
    const createNewDocument = () => {
      const newDom = elem("div", `${clsPrefix}-documents`);
      this.renderDocument(state.root, newDom);
      state.domMap.set(state.root.data.id, newDom);
      return newDom;
    }

    if (oldDom && oldDom instanceof HTMLDivElement) {
      this.renderDocument(state.root, oldDom);
      return oldDom;
    } else {
      return createNewDocument();
    }
  }

  protected renderDocument(model: TreeNode<DocNode>, dom: HTMLDivElement) {
    dom._mgNode = model;

    const { clsPrefix } = this;
    const blocksContainer = ensureChild(dom, 0, "div", `${clsPrefix}-editor-blocks-container`);
    this.renderBlocks(blocksContainer, model);
  }

  protected createBlockContainer() {
    return elem("div", this.blockClassName);
  }

  protected renderBlocks(blocksContainer: HTMLElement, parentNode: TreeNode<DocNode>) {
    let nodePtr = parentNode.firstChild;
    
    if (!nodePtr) {
      clearAllChildren(blocksContainer);
      return;
    }

    let domPtr: Node | null = blocksContainer.firstChild;
    let prevPtr: Node | undefined;

    while (nodePtr) {
      const id = nodePtr.data.id;
      const data = nodePtr.data as Block;
      const blockDef = this.editor.registry.block.getBlockDefById(data.flags);

      if (!blockDef) {
        throw new Error(`id not found: ${data.flags}`);
      }

      if (!domPtr || typeof domPtr._mgNode === "undefined" || domPtr._mgNode !== nodePtr) {
        const existDom = this.editor.state.domMap.get(id);
        if (existDom) {  // move dom from another place
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

      this.renderBlock(domPtr as HTMLElement, nodePtr, blockDef);

      nodePtr = nodePtr.next;
      prevPtr = domPtr;
      domPtr = domPtr.nextSibling;
    }
  }

  protected renderBlock(blockContainer: HTMLElement, blockNode: TreeNode<DocNode>, blockDef: IBlockDefinition) {
    if (blockDef.type === BlockContentType.Text) {
      const contentContainer = blockDef.findContentContainer!(blockContainer);
      this.renderBlockTextContent(contentContainer, blockNode.firstChild!);
    } else {
      blockDef?.render?.(blockContainer, this.editor.controller, blockNode.data.id);
    }
  }

  private initBlockContainer(blockContainer: HTMLElement, blockNode: TreeNode<DocNode>, blockDef: IBlockDefinition) {
    const { editor, clsPrefix } = this;
    const data = blockNode.data as Block;

    if (blockDef.type === BlockContentType.Custom) {
      blockContainer.contentEditable = "false";
    }

    blockContainer._mgNode = blockNode;
    editor.state.domMap.set(data.id, blockContainer);
    blockContainer.setAttribute("data-type", blockDef.name);
    blockContainer.addEventListener("mouseenter", () => {
      editor.placeBannerAt(blockContainer, blockNode);
    });
    blockDef.onContainerCreated?.({
      element: blockContainer,
      node: blockNode,
      clsPrefix,
      block: blockNode.data as Block,
    });
  }

  protected renderBlockTextContent(contentContainer: HTMLElement, lineNode: TreeNode<DocNode>) {
    const spanLen = lineNode.childrenLength;
    let childrenLen = contentContainer.childNodes.length;
    const treeChildren = (
      lineNode.firstChild ? treeChildrenToArray(lineNode.firstChild) : []
    ) as TreeNode<Span>[];
    if (childrenLen < spanLen) {
      for (let i = childrenLen; i < spanLen; i++) {
        const span = treeChildren[i];
        const spanType = span.data.flags;
        const spanDef = this.registry.span.getSpanTypeById(spanType);
        if (!spanDef) {
          throw new Error("unknown span type: " + spanType);
        }
        const newSpanDom = createSpanNode(span, spanDef);
        contentContainer.appendChild(newSpanDom);

        if (spanDef.onSpanCreated) {
          spanDef.onSpanCreated({
            element: newSpanDom as HTMLSpanElement,
            node: span,
          });
        }
      }
    } else if (childrenLen > spanLen) {
      while (childrenLen > spanLen && contentContainer.lastChild) {
        contentContainer.removeChild(contentContainer.lastChild);
        childrenLen--;
      }
    }

    for (let i = 0; i < spanLen; i++) {
      let span = treeChildren[i];
      let node = contentContainer.childNodes.item(i);
      this.renderSpan(node, span);
    }
  }

  protected renderSpan(domNode: Node, spanNode: TreeNode<Span>) {
    const { editor } = this;
    const { state } = editor;
    const { data } = spanNode;
    const spanType = data.flags;
    if (
      this.typeOfDomNode(domNode) !== spanType ||
      typeof domNode._mgNode === "undefined"
    ) {
      delete domNode._mgNode; // avoid mutation observer trigger a remove action

      const spanType = data.flags;
      const spanDef = this.registry.span.getSpanTypeById(spanType);
      if (!spanDef) {
        throw new Error("unknown span type: " + spanType);
      }
      const newNode = createSpanNode(spanNode, spanDef);
      state.domMap.set(spanNode.data.id, newNode);
      newNode._mgNode = spanNode;
      domNode.parentNode?.replaceChild(newNode, domNode);

      if (spanDef.onSpanCreated) {
        spanDef.onSpanCreated({
          element: newNode as HTMLSpanElement,
          node: spanNode,
        });
      }
      return;
    }

    state.domMap.set(spanNode.data.id, domNode);
    domNode._mgNode = spanNode;
    if (domNode.textContent !== data.content) {
      // avoid reset of cursor
      domNode.textContent = data.content;
    }
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
