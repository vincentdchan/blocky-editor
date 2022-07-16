import { isString } from "lodash-es";
import { elem, removeNode } from "blocky-common/es/dom";
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
  BlockyTextModel,
  BlockyElement,
  type AttributesObject,
  type TextNode,
} from "@pkg/model";
import { areEqualShallow } from "blocky-common/es/object";
import fastDiff from "fast-diff";
import { type Editor } from "@pkg/view/editor";
import { type Position } from "blocky-common/es/position";
import { HTMLConverter } from "@pkg/helper/htmlConverter";

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

function textTypeCanIndent(textType: TextType): boolean {
  return textType === TextType.Normal || textType === TextType.Bulleted;
}

function insertOrGetChildrenContainer(element: BlockElement): BlockyElement {
  let childrenContainer = element.childrenContainer;
  if (childrenContainer) {
    return childrenContainer;
  }

  childrenContainer = new BlockyElement("block-children");
  element.appendChild(childrenContainer);

  return childrenContainer;
}

/**
 * TextBlock is a very special block in the editor.
 * It's handling all the editable element.
 */
class TextBlock extends Block {
  #container: HTMLElement | undefined;
  #bodyContainer: HTMLElement | null = null;
  #contentContainer: HTMLElement | null = null;
  #bulletSpan: HTMLSpanElement | null = null;

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
    const contentContainer = this.findContentContainer();
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

  protected findContentContainer(): HTMLElement {
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

    element.appendChild(this.#bodyContainer);
  }

  override blockFocused({
    node: blockDom,
    selection,
    cursor,
  }: BlockFocusedEvent): void {
    const contentContainer = this.findContentContainer();

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

  override blockBlur(): void {
    const contentContainer = this.findContentContainer();
    const zeroSpaceEmptyChar = String.fromCharCode(160);
    contentContainer.setAttribute("placeholder", zeroSpaceEmptyChar);
  }

  private findFocusPosition(
    blockDom: HTMLElement,
    absoluteOffset: number
  ): TextPosition | undefined {
    const contentContainer = this.findContentContainer();
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
    if (isString(dataRef)) {
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

  override blockContentChanged({ offset }: BlockContentChangedEvent): void {
    const contentContainer = this.findContentContainer();
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
    if (!textModel || !(textModel instanceof BlockyTextModel)) {
      console.warn("expected text model, got:", textModel);
      return;
    }

    this.renderBlockTextContent(container, textModel);
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

      if (isString(href)) {
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
    contentContainer: HTMLElement
  ): HTMLElement {
    const renderedType = contentContainer.getAttribute("data-type");
    const textType = this.getTextType();

    const forceRenderContentStyle = (
      contentContainer: HTMLElement,
      textType: TextType
    ) => {
      contentContainer.setAttribute("data-type", textType.toString());
      switch (textType) {
        case TextType.Bulleted: {
          this.#bulletSpan = this.createBulletSpan();
          blockContainer.insertBefore(
            this.#bulletSpan,
            blockContainer.firstChild
          );

          contentContainer.classList.add("blocky-bulleted");
          return;
        }

        case TextType.Heading1:
        case TextType.Heading2:
        case TextType.Heading3: {
          contentContainer.classList.add(`blocky-heading${textType}`);
          break;
        }
      }

      if (this.#bulletSpan) {
        removeNode(this.#bulletSpan);
        this.#bulletSpan = null;
      }
    };

    if (!renderedType) {
      forceRenderContentStyle(contentContainer, textType);
      return contentContainer;
    }

    const oldDataType = parseInt(renderedType, 10);
    if (oldDataType !== textType) {
      this.#bodyContainer?.removeChild(this.#contentContainer!);

      const newContainer = this.createContentContainer();
      this.#bodyContainer?.insertBefore(newContainer, null);
      this.#contentContainer = newContainer;

      forceRenderContentStyle(newContainer, textType);

      return newContainer;
    }

    return contentContainer;
  }

  override get childrenContainerDOM(): HTMLElement | null {
    return this.#bodyContainer;
  }

  override get childrenBeginDOM(): HTMLElement | null {
    return this.#contentContainer;
  }

  private isNodeMatch(node: TextNode, dom: Node): boolean {
    if (node.attributes) {
      if (isString(node.attributes.href)) {
        return (
          dom instanceof HTMLElement && isString(dom.getAttribute(DataRefKey))
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
  private isAttributesMatch(
    span: HTMLSpanElement,
    attributes: AttributesObject
  ): boolean {
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
    textModel: BlockyTextModel
  ) {
    const contentContainer = this.ensureContentContainerStyle(
      blockContainer,
      this.#contentContainer!
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
    if (!textTypeCanIndent(textType)) {
      return;
    }

    const prevCursorState = this.editor.state.cursorState;
    this.editor.state.cursorState = undefined;

    this.editor.update(() => {
      const parentElement = this.props.parent as BlockyElement | undefined;
      if (!parentElement) {
        return;
      }

      const copy = this.props.clone();

      parentElement.removeChild(this.props);

      const prevBlockyElement = prevElement as BlockElement;
      const childrenContainer = insertOrGetChildrenContainer(prevBlockyElement);
      childrenContainer.appendChild(copy);

      return () => {
        this.editor.state.cursorState = prevCursorState;
      };
    }, false);
  }

  /**
   * delete this node, append to the parent
   */
  override onDedent(): void {
    const parentBlockElement = this.findParentBlockElement();
    if (!parentBlockElement) {
      return;
    }

    const prevCursorState = this.editor.state.cursorState;
    this.editor.state.cursorState = undefined;

    this.editor.update(() => {
      const parentElement = this.props.parent! as BlockyElement;

      const copy = this.props.clone();

      parentElement.removeChild(this.props);

      const parentOfParentBlockElement =
        parentBlockElement.parent as BlockyElement;
      parentOfParentBlockElement.insertAfter(copy, parentBlockElement);

      return () => {
        this.editor.state.cursorState = prevCursorState;
      };
    }, false);
  }

  private findParentBlockElement(): BlockElement | undefined {
    let result = this.props.parent;

    while (result) {
      if (result instanceof BlockElement) {
        return result;
      }

      result = result.parent;
    }
  }
}

function clearNodeAttributes(node: Node) {
  if (node instanceof HTMLSpanElement && node.style.length !== 0) {
    node.setAttribute("style", "");
  }
}

class TextBlockDefinition implements IBlockDefinition {
  name: string = TextBlockName;
  editable = true;

  onBlockCreated({ blockElement: data }: BlockCreatedEvent): Block {
    return new TextBlock(this, data);
  }

  onPaste({
    editor,
    node: container,
    converter,
  }: BlockPasteEvent): BlockElement | undefined {
    return this.#getTextElementFromDOM(editor, container, converter);
  }

  /**
   * Rebuild the data structure from the pasted html.
   */
  #getTextElementFromDOM(
    editor: Editor,
    node: HTMLElement,
    converter: HTMLConverter
  ): BlockElement {
    const newId = editor.idGenerator.mkBlockId();
    const result = new BlockElement(TextBlockName, newId);

    const textModel = new BlockyTextModel();
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
          if (converter.isContainerElement(childPtr)) {
            const childElements = converter.parseContainerElement(childPtr);
            if (childElements.length > 0) {
              const childrenContainer = insertOrGetChildrenContainer(result);
              for (const element of childElements) {
                childrenContainer.appendChild(element);
              }
            }
          } else {
            const content = childPtr.textContent ?? "";
            const attributes = editor.getAttributesBySpan(childPtr);
            textModel.insert(index, content, attributes);
            index += content.length;
          }
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

export function setTextTypeForTextBlock(
  blockElement: BlockElement,
  textType: TextType
) {
  blockElement.setAttribute("textType", textType.toString());
}

export function getTextTypeForTextBlock(blockElement: BlockElement): TextType {
  return parseInt(blockElement.getAttribute("textType") || "0", 10);
}
