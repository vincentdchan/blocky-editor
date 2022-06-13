import { elem } from "blocky-common/es/dom";
import {
  type Block,
  type TreeNode,
  type Span,
  type DocNode,
  treeChildrenToArray,
} from "@pkg/model/index";
import type { Editor, EditorRegistry } from "@pkg/view/editor";
import type { ISpanType } from "@pkg/registry/spanRegistry";

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

/**
 * Line
 * - line content
 * - line children
 */
export interface ILineRenderer {
  createLineElement(): HTMLDivElement;
  getLineContentElement(lineContainer: HTMLDivElement): HTMLDivElement;
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
    const { childrenLength } = parentNode;
    let actualLen = blocksContainer.children.length;
    if (actualLen < childrenLength) {
      for (let i = actualLen; i < childrenLength; i++) {
        const newBlockContainer = this.createBlockContainer();
        blocksContainer.appendChild(newBlockContainer);
      }
    } else if (actualLen > childrenLength) {
      while (actualLen > childrenLength && blocksContainer.lastChild) {
        blocksContainer.removeChild(blocksContainer.lastChild);
        actualLen--;
      }
    }

    let ptr = parentNode.firstChild;
    let childElement = blocksContainer.firstElementChild;
    while (ptr && childElement) {
      this.renderBlock(childElement as HTMLElement, ptr);
      ptr = ptr.next;
      childElement = childElement.nextElementSibling;
    }
  }

  protected renderBlock(blockContainer: HTMLElement, blockNode: TreeNode<DocNode>) {
    const { editor, clsPrefix } = this;
    const data = blockNode.data as Block;
    const blockDef = editor.registry.block.getBlockDefById(data.flags);

    if (!blockDef) {
      throw new Error(`id not found: ${data.flags}`);
    }

    if (blockContainer._mgNode !== blockNode) {
      blockContainer._mgNode = blockNode;
      blockContainer.setAttribute("data-type", blockDef.name);
      blockContainer.addEventListener("mouseenter", () => {
        editor.placeBannerAt(blockContainer, blockNode);
      });
      blockDef.onContainerCreated?.({
        element: blockContainer,
        node: blockNode,
        clsPrefix,
      });
    }

    editor.state.domMap.set(data.id, blockContainer);

    const contentContainer = blockDef.findContentContainer!(blockContainer);

    this.renderBlockTextContent(contentContainer, blockNode.firstChild!);
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
