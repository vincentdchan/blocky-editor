import { elem } from "blocky-common/es/dom";
import {
  type Block,
  type TreeNode,
  type Span,
  type DocNode,
  treeChildrenToArray,
} from "model/index";
import type { Editor, EditorRegistry } from "view/editor";
import type { ISpanType } from "registry/spanRegistry";

interface DocRenderOptions {
  editor: Editor;
  registry: EditorRegistry;
  oldDom?: Node;
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

export function docRenderer(options: DocRenderOptions): HTMLDivElement {
  const { editor, oldDom } = options;
  const { state } = editor;
  function createNewDocument() {
    const newDom = elem("div", "mg-documents");
    renderDocument(options, state.root, newDom);
    state.domMap.set(state.root.data.id, newDom);
    return newDom;
  }

  if (oldDom && oldDom instanceof HTMLDivElement) {
    const oldState = oldDom._mgNode;
    if (typeof oldState === "undefined") {
      const newDom = createNewDocument();
      oldDom.parentElement?.replaceChild(newDom, oldDom);
      return newDom;
    }
    renderDocument(options, state.root, oldDom);
    return oldDom;
  } else {
    return createNewDocument();
  }
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

function renderDocument(
  options: DocRenderOptions,
  model: TreeNode<DocNode>,
  dom: HTMLDivElement,
) {
  dom._mgNode = model;

  const blocksContainer = ensureChild(dom, 0, "div", "mg-editor-blocks-container");
  renderBlocks(options, blocksContainer, model);
}

function createBlockContainer() {
  return elem("div", "mg-editor-block");
}

function renderBlocks(
  options: DocRenderOptions,
  blocksContainer: HTMLElement,
  parentNode: TreeNode<DocNode>,
) {
  const { childrenLength } = parentNode;
  let actualLen = blocksContainer.children.length;
  if (actualLen < childrenLength) {
    for (let i = actualLen; i < childrenLength; i++) {
      const newBlockContainer = createBlockContainer();
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
    renderBlock(options, childElement as HTMLElement, ptr);
    ptr = ptr.next;
    childElement = childElement.nextElementSibling;
  }
}

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

function renderBlock(
  options: DocRenderOptions,
  blockContainer: HTMLElement,
  blockNode: TreeNode<DocNode>,
) {
  const { editor } = options;
  const data = blockNode.data as Block;
  const blockDef = editor.registry.block.getBlockDefById(data.flags);

  if (!blockDef) {
    throw new Error(`id not found: ${data.flags}`);
  }

  if (blockContainer._mgNode !== blockNode) {
    blockContainer._mgNode = blockNode;
    blockContainer.setAttribute("data-type", data.flags.toString());
    blockContainer.addEventListener("mouseenter", () => {
      editor.placeBannerAt();
    });
    blockContainer.addEventListener("mouseleave", () => {
      editor.hideBanner();
    });
    blockDef.onContainerCreated?.({ element: blockContainer, node: blockNode });
  }

  editor.state.domMap.set(data.id, blockContainer);

  const contentContainer = blockDef.findContentContainer!(blockContainer);

  renderBlockTextContent(options, contentContainer, blockNode.firstChild!);
}

function renderBlockTextContent(
  options: DocRenderOptions,
  contentContainer: HTMLElement,
  lineNode: TreeNode<DocNode>,
) {
  const spanLen = lineNode.childrenLength;
  let childrenLen = contentContainer.childNodes.length;
  const treeChildren = (
    lineNode.firstChild ? treeChildrenToArray(lineNode.firstChild) : []
  ) as TreeNode<Span>[];
  if (childrenLen < spanLen) {
    for (let i = childrenLen; i < spanLen; i++) {
      const span = treeChildren[i];
      const spanType = span.data.flags;
      const spanDef = options.registry.span.getSpanTypeById(spanType);
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
    renderSpan(options, node, span);
  }
}

function typeOfDomNode(
  options: DocRenderOptions,
  node: Node,
): number | undefined {
  if (node instanceof Text) {
    return 0;
  } else if (node instanceof HTMLSpanElement) {
    const ty = parseInt(node.getAttribute("data-type") || "0", 10);
    return ty;
  }
  return undefined;
}

function renderSpan(
  options: DocRenderOptions,
  domNode: Node,
  spanNode: TreeNode<Span>,
) {
  const { editor } = options;
  const { state } = editor;
  const { data } = spanNode;
  const spanType = data.flags;
  if (
    typeOfDomNode(options, domNode) !== spanType ||
    typeof domNode._mgNode === "undefined"
  ) {
    delete domNode._mgNode; // avoid mutation observer trigger a remove action

    const spanType = data.flags;
    const spanDef = options.registry.span.getSpanTypeById(spanType);
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
