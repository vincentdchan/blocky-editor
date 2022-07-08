import { clearAllChildren, elem } from "blocky-common/es/dom";
import {
  type IBlockDefinition,
  type BlockCreatedEvent,
  type BlockDidMountEvent,
  type BlockFocusedEvent,
  type BlockContentChangedEvent,
  type BlockPasteEvent,
  type CursorDomResult,
  Block,
  BlockElement,
} from "./basic";
import {
  TextType,
  CursorState,
  BlockyTextModel,
  type AttributesObject,
  type TextNode,
  BlockyElement,
} from "@pkg/model";
import { areEqualShallow } from "blocky-common/es/object";
import fastDiff from "fast-diff";
import { type Editor } from "@pkg/view/editor";
import { type Position } from "blocky-common/es/position";

export const TextBlockName = "Text";

const TextContentClass = "blocky-block-text-content";

const DataRefKey = "data-href";

const zeroSpaceEmptyChar = String.fromCharCode(160);

interface TextPosition {
  node: Node;
  offset: number;
}

interface FormattedTextSlice {
  index: number;
  length: number;
  attributes?: AttributesObject;
}

function textModelToFormats(textModel: BlockyTextModel): FormattedTextSlice[] {
  const formats: FormattedTextSlice[] = [];

  let ptr = textModel.nodeBegin;
  let index = 0;
  while (ptr) {
    formats.push({
      index,
      length: ptr.content.length,
      attributes: ptr.attributes,
    });
    index += ptr.content.length;
    ptr = ptr.next;
  }

  return formats;
}

function getTextTypeFromElement(element: BlockyElement): TextType {
  return parseInt(element.getAttribute("textType") ?? "0", 10);
}

class TextBlock extends Block {
  #container: HTMLElement | undefined;
  #bodyContainer: HTMLElement | undefined;
  #contentContainer: HTMLElement | undefined;

  constructor(private def: TextBlockDefinition, props: BlockElement) {
    super(props);
  }

  private getTextType(): TextType {
    return getTextTypeFromElement(this.elementData);
  }

  override getCursorHeight(): number {
    const textType = this.getTextType();
    switch (textType) {
      case TextType.Heading1:
        return 34;
      case TextType.Heading2:
        return 30;
      case TextType.Heading3:
        return 26;
    }
    
    return 18;
  }

  override getBannerOffset(): Position {
    const textType = this.getTextType();

    if (textType > 0) {
      return { x: 0, y: 12 };
    }

    if (textType === TextType.Normal) {
      return { x: 0, y: 2 };
    }

    return { x: 0, y: 0 };
  }

  override findTextOffsetInBlock(
    focusedNode: Node,
    offsetInNode: number
  ): number {
    const blockContainer = this.#container!;
    const contentContainer = this.findContentContainer!(
      blockContainer as HTMLElement
    );
    let counter = 0;
    let ptr = contentContainer.firstChild;

    const parentOfFocused = focusedNode.parentNode!;
    if (parentOfFocused instanceof HTMLSpanElement) {
      focusedNode = parentOfFocused;
    }

    while (ptr) {
      if (ptr === focusedNode) {
        break;
      }
      counter += ptr.textContent?.length ?? 0;
      ptr = ptr.nextSibling;
    }

    return counter + offsetInNode;
  }

  protected findContentContainer(parent: HTMLElement): HTMLElement {
    const e = this.#contentContainer;
    if (!e) {
      throw new Error("content not found");
    }
    return e;
  }

  private createContentContainer(): HTMLElement {
    const e = elem("div", TextContentClass);
    e.setAttribute("placeholder", zeroSpaceEmptyChar);
    return e;
  }

  private createTextBodyContainer(): HTMLElement {
    const e = elem("div", "blocky-text-body");
    return e;
  }

  override blockDidMount({ element }: BlockDidMountEvent): void {
    element.classList.add("blocky-flex");

    this.#bodyContainer = this.createTextBodyContainer();

    this.#contentContainer = this.createContentContainer();
    this.#bodyContainer.append(this.#contentContainer);

    this.childrenContainerDOM = this.#bodyContainer;
    this.childrenBeginDOM = this.#contentContainer;

    element.appendChild(this.#bodyContainer);
  }

  override blockFocused({
    node: blockDom,
    selection,
    cursor,
  }: BlockFocusedEvent): void {
    const contentContainer = this.findContentContainer(blockDom);

    contentContainer.setAttribute("placeholder", "Empty content");

    const { offset } = cursor;
    const pos = this.findFocusPosition(blockDom, offset);
    if (!pos) {
      const { firstChild } = contentContainer;

      if (firstChild == null) {
        setRangeIfDifferent(
          selection,
          contentContainer,
          0,
          contentContainer,
          0
        );
        return;
      }

      setRangeIfDifferent(selection, firstChild, 0, firstChild, 0);
    } else {
      const { node, offset } = pos;
      setRangeIfDifferent(selection, node, offset, node, offset);
    }
  }

  override getCursorDomByOffset(offset: number): CursorDomResult | undefined {
    if (!this.#container) {
      return;
    }

    return this.findFocusPosition(this.#container, offset);
  }

  override blockBlur({ node: blockDom }: BlockFocusedEvent): void {
    const contentContainer = this.findContentContainer(blockDom);
    const zeroSpaceEmptyChar = String.fromCharCode(160);
    contentContainer.setAttribute("placeholder", zeroSpaceEmptyChar);
  }

  private findFocusPosition(
    blockDom: HTMLElement,
    absoluteOffset: number
  ): TextPosition | undefined {
    const contentContainer = this.findContentContainer(blockDom);
    let ptr = contentContainer.firstChild;

    while (ptr) {
      const contentLength = ptr.textContent?.length ?? 0;
      if (absoluteOffset <= contentLength) {
        let node = ptr;
        if (node instanceof HTMLSpanElement && node.firstChild) {
          node = node.firstChild;
        }
        return { node, offset: absoluteOffset };
      } else {
        absoluteOffset -= contentLength;
      }

      ptr = ptr.nextSibling;
    }

    return;
  }

  private getAttributeObjectFromElement(
    element: HTMLElement
  ): AttributesObject {
    const attributes: AttributesObject = {};
    const spanRegistry = this.editor.registry.span;

    for (const clsName of element.classList) {
      const style = spanRegistry.classnames.get(clsName);
      if (style) {
        attributes[style.name] = true;
      }
    }

    const dataRef = element.getAttribute(DataRefKey);
    if (typeof dataRef === "string") {
      attributes.href = dataRef;
    }

    return attributes;
  }

  /**
   * Convert DOM to [[FormattedTextSlice]]
   */
  private getFormattedTextSliceFromNode(
    index: number,
    node: Node
  ): FormattedTextSlice {
    if (node instanceof HTMLSpanElement) {
      const attributes = this.getAttributeObjectFromElement(node);
      return { index, length: node.textContent?.length ?? 0, attributes };
    } else {
      return {
        index,
        length: node.textContent?.length ?? 0,
        attributes: undefined,
      };
    }
  }

  override blockContentChanged({
    node,
    offset,
  }: BlockContentChangedEvent): void {
    const contentContainer = this.findContentContainer(node);
    const formats: FormattedTextSlice[] = [];

    let textContent = "";

    let ptr = contentContainer.firstChild;
    let idx = 0;
    while (ptr) {
      const format = this.getFormattedTextSliceFromNode(idx, ptr);
      formats.push(format);

      idx += ptr.textContent?.length ?? 0;
      textContent += ptr.textContent;
      ptr = ptr.nextSibling;
    }

    const textModel = this.props.firstChild! as BlockyTextModel;
    const oldContent = textModel.toString();

    const diffs = fastDiff(oldContent, textContent, offset);

    let index = 0;
    for (const [t, content] of diffs) {
      if (t === fastDiff.EQUAL) {
        index += content.length;
      } else if (t === fastDiff.INSERT) {
        textModel.insert(index, content);
        index += content.length;
      } else if (t === fastDiff.DELETE) {
        textModel.delete(index, content.length);
        // index -= content.length;
      }
    }

    this.diffAndApplyFormats(formats, textModel);
  }

  private diffAndApplyFormats(
    newFormats: FormattedTextSlice[],
    textModel: BlockyTextModel
  ) {
    const oldFormats: FormattedTextSlice[] = textModelToFormats(textModel);

    const slices: (FormattedTextSlice | undefined)[] = Array(textModel.length);

    for (const format of newFormats) {
      slices[format.index] = format;
    }

    for (const oldFormat of oldFormats) {
      const f = slices[oldFormat.index];
      if (!f) {
        // format doesn't anymore, erase it.
        textModel.format(oldFormat.index, oldFormat.length, undefined);
        continue;
      }

      if (!areEqualShallow(f.attributes, oldFormat.attributes)) {
        if (oldFormat.length !== f.length) {
          // length are different, erase it firstly
          textModel.format(oldFormat.index, oldFormat.length, undefined);
        }
        textModel.format(f.index, f.length, f.attributes);
      }

      slices[oldFormat.index] = undefined;
    }

    for (let i = 0, len = slices.length; i < len; i++) {
      const f = slices[i];
      if (f) {
        textModel.format(f.index, f.length, f.attributes);
      }
    }
  }

  override render(container: HTMLElement) {
    this.#container = container;

    const textModel = this.props.firstChild! as BlockyTextModel;

    const contentContainer = this.findContentContainer(container);
    this.renderBlockTextContent(container, contentContainer, textModel);
  }

  private createAnchorNode(href: string): HTMLSpanElement {
    const e = elem("span");
    e.classList.add(this.editor.anchorSpanClass);
    e.setAttribute(DataRefKey, href);

    e.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      this.editor.openExternalLink(href);
    });

    return e;
  }

  private createDomByNode(node: TextNode, editor: Editor): Node {
    if (node.attributes) {
      let d: HTMLElement;

      const { href, ...restAttr } = node.attributes;

      if (typeof href === "string") {
        d = this.createAnchorNode(href);
      } else {
        d = elem("span");
      }

      d.textContent = node.content;

      const spanRegistry = editor.registry.span;

      for (const key of Object.keys(restAttr)) {
        if (restAttr[key]) {
          const style = spanRegistry.styles.get(key);
          if (style) {
            d.classList.add(style.className);
            style.onSpanCreated?.(d);
          }
        }
      }

      return d;
    } else {
      return document.createTextNode(node.content);
    }
  }

  private createBulletSpan() {
    const container = elem("div", "blocky-bullet");
    container.contentEditable = "false";

    const bulletContent = elem("div", "blocky-bullet-content");
    container.appendChild(bulletContent);

    return container;
  }

  private ensureContentContainerStyle(
    blockContainer: HTMLElement,
    contentContainer: HTMLElement,
    textModel: BlockyTextModel 
  ): HTMLElement {
    const renderedType = contentContainer.getAttribute("data-type");
    const textType = this.getTextType();

    const forceRenderContentStyle = (
      parent: HTMLElement,
      contentContainer: HTMLElement,
      textType: TextType
    ) => {
      switch (textType) {
        case TextType.Bulleted: {
          const bulletSpan = this.createBulletSpan();
          blockContainer.insertBefore(bulletSpan, blockContainer.firstChild);

          contentContainer.classList.add("blocky-bulleted");
          break;
        }

        case TextType.Heading1:
        case TextType.Heading2:
        case TextType.Heading3:
          contentContainer.classList.add(`blocky-heading${textType}`);
          break;

        default: {
        }
      }

      contentContainer.setAttribute("data-type", textType.toString());
    };

    const parent = contentContainer.parentElement!;
    if (!renderedType) {
      forceRenderContentStyle(parent, contentContainer, textType);
      return contentContainer;
    }

    const oldDataType = parseInt(renderedType, 10);
    if (oldDataType !== textType) {
      clearAllChildren(parent);

      const newContainer = this.createContentContainer();
      parent.appendChild(newContainer);
      forceRenderContentStyle(parent, newContainer, textType);

      return newContainer;
    }

    return contentContainer;
  }

  private isNodeMatch(node: TextNode, dom: Node): boolean {
    if (node.attributes) {
      if (typeof node.attributes.href === "string") {
        return (
          dom instanceof HTMLElement &&
          typeof dom.getAttribute(DataRefKey) === "string"
        );
      }
      const testSpan = dom instanceof HTMLSpanElement;
      if (!testSpan) {
        return false;
      }

      return this.isAttributesMatch(dom, node.attributes);
    }

    return node instanceof Text;
  }

  // TODO: optimize this method
  private isAttributesMatch(span: HTMLSpanElement, attributes: AttributesObject): boolean {
    for (const key of Object.keys(attributes)) {
      if (key === "href") {
        continue;
      }
      if (attributes[key] && !span.classList.contains(key)) {
        return false;
      }
    }

    return true;
  }

  private renderBlockTextContent(
    blockContainer: HTMLElement,
    contentContainer: HTMLElement,
    textModel: BlockyTextModel,
  ) {
    contentContainer = this.ensureContentContainerStyle(
      blockContainer,
      contentContainer,
      textModel
    );

    let nodePtr = textModel.nodeBegin;
    let domPtr: Node | null = contentContainer.firstChild;
    let prevDom: Node | null = null;

    while (nodePtr) {
      if (!domPtr) {
        domPtr = this.createDomByNode(nodePtr, this.editor);
        contentContainer.insertBefore(domPtr, prevDom?.nextSibling ?? null);
      } else {
        // is old
        if (!this.isNodeMatch(nodePtr, domPtr)) {
          const oldDom = domPtr;
          const newNode = this.createDomByNode(nodePtr, this.editor);

          nodePtr = nodePtr.next;
          prevDom = domPtr;
          domPtr = domPtr.nextSibling;

          contentContainer.replaceChild(newNode, oldDom);
          continue;
        } else {
          clearNodeAttributes(domPtr);
          if (domPtr.textContent !== nodePtr.content) {
            domPtr.textContent = nodePtr.content;
          }
        }
      }

      nodePtr = nodePtr.next;
      prevDom = domPtr;
      domPtr = domPtr.nextSibling;
    }

    // remove remaining text
    while (domPtr) {
      const next = domPtr.nextSibling;
      domPtr.parentNode?.removeChild(domPtr);

      domPtr = next;
    }
  }

  override onIndent(): void {
    const prevElement = this.props.prevSibling as BlockyElement | undefined;
    if (!prevElement) {
      return;
    }
    this.makeThisTextBlockIndent(prevElement);
  }

  private makeThisTextBlockIndent(prevElement: BlockyElement) {
    if (prevElement.nodeName !== TextBlockName) {
      return;
    }

    const textType = getTextTypeFromElement(prevElement);
    if (textType !== TextType.Normal && textType !== TextType.Bulleted) {
      return;
    }

    this.editor.update(() => {
      const parentElement = this.props.parent as BlockyElement | undefined;
      if (!parentElement) {
        return;
      }

      const copy = this.props.clone();

      parentElement.removeChild(this.props);

      const prevBlockyElement = prevElement as BlockElement;
      const childrenContainer = this.insertOrGetChildrenContainer(prevBlockyElement);
      childrenContainer.appendChild(copy);
    });
  }

  private insertOrGetChildrenContainer(element: BlockElement): BlockyElement {
    let childrenContainer = element.childrenContainer;
    if (childrenContainer) {
      return childrenContainer;
    }

    childrenContainer = new BlockyElement("block-children");
    element.appendChild(childrenContainer);

    return childrenContainer;
  }

  override onDedent(): void {
    const textType = this.getTextType();
    if (textType === TextType.Bulleted) {
      console.log("dedent text");
    }
  }

}

function clearNodeAttributes(node: Node) {
  if (node instanceof HTMLSpanElement && node.style.length !== 0) {
    node.setAttribute("style", "");
  }
}

class TextBlockDefinition implements IBlockDefinition {
  public name: string = TextBlockName;
  public editable = true;

  onBlockCreated({ blockElement: data }: BlockCreatedEvent): Block {
    return new TextBlock(this, data);
  }

  onPaste({
    after: cursorState,
    node: container,
    editor,
    tryMerge,
  }: BlockPasteEvent): CursorState | undefined {
    if (!cursorState) {
      return;
    }

    if (cursorState.type === "open") {
      return;
    }

    const currentElement = editor.state.idMap.get(cursorState.targetId)! as BlockElement;
    const parentElement = currentElement.parent! as BlockyElement;
    const newTextElement = this.getTextElementFromDOM(editor, container);
    const newTextModel = newTextElement.firstChild! as BlockyTextModel;

    if (tryMerge && currentElement.nodeName === TextBlockName) {
      const oldTextModel = currentElement.firstChild! as BlockyTextModel;
      oldTextModel.append(newTextModel);
      return;
    }

    parentElement.insertAfter(newTextElement, currentElement);

    return {
      type: "collapsed",
      targetId: newTextElement.id,
      offset: 0,
    };
  }

  /**
   * Rebuild the data structure from the pasted html.
   */
  private getTextElementFromDOM(
    editor: Editor,
    node: HTMLElement
  ): BlockElement {
    const newId = editor.idGenerator.mkBlockId();
    const result = new BlockElement(TextBlockName, newId);

    const textModel = new BlockyTextModel;
    result.appendChild(textModel);

    // TODO: Maybe using querySelector is slow.
    // Should make a benchmark here
    let textContentContainer = node.querySelector(".blocky-block-text-content");

    // if content container if not found, using the node directly
    if (!textContentContainer) {
      textContentContainer = node;
    }

    let index = 0;
    if (textContentContainer) {
      let childPtr = textContentContainer.firstChild;

      const dataType = textContentContainer.getAttribute("data-type") || "0";
      const dataTypeInt = parseInt(dataType, 10);
      setTextTypeForTextBlock(result, dataTypeInt);

      while (childPtr) {
        if (childPtr instanceof Text) {
          const content = childPtr.textContent ?? "";
          textModel.insert(index, content);
          index += content.length;
        } else if (childPtr instanceof HTMLElement) {
          const content = childPtr.textContent ?? "";
          const attributes = editor.getAttributesBySpan(childPtr);
          textModel.insert(index, content, attributes);
          index += content.length;
        }

        childPtr = childPtr.nextSibling;
      }
    } else {
      textModel.insert(0, node.textContent ?? "");
    }

    const { tagName } = node;
    if (tagName === "H1") {
      setTextTypeForTextBlock(result, TextType.Heading1);
    } else if (tagName === "H2") {
      setTextTypeForTextBlock(result, TextType.Heading2);
    } else if (tagName === "H3") {
      setTextTypeForTextBlock(result, TextType.Heading3);
    } else if (tagName === "LI") {
      setTextTypeForTextBlock(result, TextType.Bulleted);
    }

    return result;
  }
}

function setRangeIfDifferent(
  sel: Selection,
  startContainer: Node,
  startOffset: number,
  endContainer: Node,
  endOffset: number
) {
  if (isRangeEqual(sel, startContainer, startOffset, endContainer, endOffset)) {
    return;
  }
  sel.removeAllRanges();
  const range = document.createRange();
  range.setStart(startContainer, startOffset);
  range.setEnd(endContainer, endOffset);
  sel.addRange(range);
}

function isRangeEqual(
  sel: Selection,
  startContainer: Node,
  startOffset: number,
  endContainer: Node,
  endOffset: number
): boolean {
  if (sel.rangeCount === 0) {
    return false;
  }
  const range = sel.getRangeAt(0);

  return (
    range.startContainer === startContainer &&
    range.startOffset === startOffset &&
    range.endContainer === endContainer &&
    range.endOffset === endOffset
  );
}

export function makeTextBlockDefinition(): IBlockDefinition {
  return new TextBlockDefinition();
}

export function setTextTypeForTextBlock(blockElement: BlockElement, textType: TextType) {
  blockElement.setAttribute("textType", textType.toString());
}

export function getTextTypeForTextBlock(blockElement: BlockElement): TextType {
  return parseInt(blockElement.getAttribute("textType") || "0", 10);
}
