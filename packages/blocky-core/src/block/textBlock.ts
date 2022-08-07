import { isString } from "lodash-es";
import Delta, { Op } from "quill-delta-es";
import { elem, removeNode, $on } from "blocky-common/es/dom";
import {
  type IBlockDefinition,
  type BlockCreatedEvent,
  type BlockDidMountEvent,
  type BlockFocusedEvent,
  type BlockContentChangedEvent,
  type BlockPasteEvent,
  type CursorDomResult,
  Block,
} from "./basic";
import { TextType, EditorState } from "@pkg/model";
import {
  type AttributesObject,
  BlockyTextModel,
  BlockyElement,
  BlockyNode,
  BlockElement,
  Changeset,
} from "blocky-data";
import { TextInputEvent, type Editor } from "@pkg/view/editor";
import { type Position } from "blocky-common/es/position";
import { HTMLConverter } from "@pkg/helper/htmlConverter";
import { EditorController } from "..";

const TextContentClass = "blocky-block-text-content";

const DataRefKey = "data-href";

const zeroSpaceEmptyChar = String.fromCharCode(160);

interface TextPosition {
  node: Node;
  offset: number;
}

function getTextTypeFromElement(element: BlockyElement): TextType {
  return parseInt(element.getAttribute("textType") ?? "0", 10);
}

function textTypeCanIndent(textType: TextType): boolean {
  return textType === TextType.Normal || textType === TextType.Bulleted;
}

class LeftPadRenderer {
  constructor(readonly container: HTMLDivElement) {}
  render() {}
  dispose(): void {
    removeNode(this.container);
  }
}

const checkedColor = "rgb(240, 153, 56)";

class CheckboxRenderer extends LeftPadRenderer {
  #checkboxContainer: HTMLDivElement;
  #centerElement: HTMLDivElement;
  #checked = false;
  constructor(
    container: HTMLDivElement,
    private state: EditorState,
    private blockElement: BlockElement
  ) {
    super(container);
    this.#checkboxContainer = elem("div", "blocky-checkbox");
    container.append(this.#checkboxContainer);

    this.#centerElement = elem("div", "blocky-checkbox-center");
    this.#centerElement.style.backgroundColor = checkedColor;
    this.#checkboxContainer.appendChild(this.#centerElement);
    this.#centerElement.style.visibility = "hidden";
    this.#checkboxContainer.style.boxShadow = `0px 0px 0px 1px gray`;

    $on(this.#checkboxContainer, "click", this.#handleClick);
  }
  #handleClick = () => {
    const checked = !!this.blockElement.getAttribute("checked");
    new Changeset(this.state)
      .updateAttributes(this.blockElement, { checked: !checked })
      .apply({
        refreshCursor: true,
      });
  };
  override render(): void {
    const checked = !!this.blockElement.getAttribute("checked");
    if (checked == this.#checked) {
      return;
    }
    if (checked) {
      this.#centerElement.style.visibility = "";
      this.#checkboxContainer.style.boxShadow = `0px 0px 0px 1px ${checkedColor}`;
    } else {
      this.#centerElement.style.visibility = "hidden";
      this.#checkboxContainer.style.boxShadow = `0px 0px 0px 1px gray`;
    }
    this.#checked = checked;
  }
}

/**
 * TextBlock is a very special block in the editor.
 * It's handling all the editable element.
 */
export class TextBlock extends Block {
  static Name = "Text";

  #container: HTMLElement | undefined;
  #bodyContainer: HTMLElement | null = null;
  #contentContainer: HTMLElement | null = null;
  #leftPadRenderer: LeftPadRenderer | null = null;

  constructor(props: BlockElement) {
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
  private getFormattedTextSliceFromNode(newDelta: Delta, node: Node) {
    const content = node.textContent ?? "";
    if (node instanceof HTMLSpanElement) {
      const attributes = this.getAttributeObjectFromElement(node);
      newDelta.insert(content, attributes);
    } else {
      newDelta.insert(content);
    }
  }

  override blockContentChanged({
    changeset,
    offset,
    blockElement,
  }: BlockContentChangedEvent): void {
    const contentContainer = this.findContentContainer();

    const newDelta = new Delta();

    let ptr = contentContainer.firstChild;
    while (ptr) {
      this.getFormattedTextSliceFromNode(newDelta, ptr);
      ptr = ptr.nextSibling;
    }

    const beforeDelta = this.textModel.delta;

    const diff = beforeDelta.diff(newDelta, offset);
    changeset.textEdit(this.props, "textContent", () => diff);

    this.editor.addStagedInput(
      new TextInputEvent(beforeDelta, diff, blockElement)
    );
  }

  get textModel(): BlockyTextModel {
    return this.props.getAttribute<BlockyTextModel>("textContent")!;
  }

  override render(container: HTMLElement) {
    this.#container = container;

    const textModel = this.textModel;
    if (!textModel || !(textModel instanceof BlockyTextModel)) {
      console.warn("expected text model, got:", textModel);
      return;
    }

    this.#renderBlockTextContent(container, textModel);
  }

  override renderChildren(): BlockyNode | void | null {
    return this.props.firstChild;
  }

  #createAnchorNode(href: string): HTMLSpanElement {
    const e = elem("span");
    e.classList.add(this.editor.anchorSpanClass);
    e.setAttribute(DataRefKey, href);

    e.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      this.editor.openExternalLink(href);
    });

    return e;
  }

  #createDomByOp(op: Op, editor: Editor): Node {
    if (op.attributes) {
      let d: HTMLElement;

      const { href, ...restAttr } = op.attributes;

      if (isString(href)) {
        d = this.#createAnchorNode(href);
      } else {
        d = elem("span");
      }

      d.textContent = op.insert! as string;

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
      return document.createTextNode(op.insert! as string);
    }
  }

  #createLeftPadContainer(): HTMLDivElement {
    const container = elem("div", "blocky-left-pad");
    container.contentEditable = "false";
    return container;
  }

  #createBulletRenderer(): LeftPadRenderer {
    const container = this.#createLeftPadContainer();

    const bulletContent = elem("div", "blocky-bullet-content");
    container.appendChild(bulletContent);

    return new LeftPadRenderer(container);
  }

  #createCheckboxRenderer(): LeftPadRenderer {
    const container = this.#createLeftPadContainer();

    return new CheckboxRenderer(container, this.editor.state, this.props);
  }

  // TODO: dispatch through plugin
  #forceRenderContentStyle(
    blockContainer: HTMLElement,
    contentContainer: HTMLElement,
    textType: TextType
  ) {
    contentContainer.setAttribute("data-type", textType.toString());
    switch (textType) {
      case TextType.Checkbox: {
        this.#leftPadRenderer = this.#createCheckboxRenderer();
        blockContainer.insertBefore(
          this.#leftPadRenderer.container,
          blockContainer.firstChild
        );
        return;
      }

      case TextType.Bulleted: {
        this.#leftPadRenderer = this.#createBulletRenderer();
        blockContainer.insertBefore(
          this.#leftPadRenderer.container,
          blockContainer.firstChild
        );
        return;
      }

      case TextType.Heading1:
      case TextType.Heading2:
      case TextType.Heading3: {
        contentContainer.classList.add(`blocky-heading${textType}`);
        break;
      }
    }

    if (this.#leftPadRenderer) {
      this.#leftPadRenderer.dispose();
      this.#leftPadRenderer = null;
    }
  }

  /**
   * If textType changed, force update the style and create new LeftPad renderer.
   */
  #ensureContentContainerStyle(
    blockContainer: HTMLElement,
    contentContainer: HTMLElement
  ): HTMLElement {
    const renderedType = contentContainer.getAttribute("data-type");
    const textType = this.getTextType();

    if (!renderedType) {
      this.#forceRenderContentStyle(blockContainer, contentContainer, textType);
      return contentContainer;
    }

    const oldDataType = parseInt(renderedType, 10);
    if (oldDataType !== textType) {
      this.#bodyContainer?.removeChild(this.#contentContainer!);

      const newContainer = this.createContentContainer();
      this.#bodyContainer?.insertBefore(newContainer, null);
      this.#contentContainer = newContainer;

      this.#forceRenderContentStyle(blockContainer, newContainer, textType);

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

  #isNodeMatch(op: Op, dom: Node): boolean {
    if (op.attributes) {
      if (isString(op.attributes.href)) {
        return (
          dom instanceof HTMLElement && isString(dom.getAttribute(DataRefKey))
        );
      }
      const testSpan = dom instanceof HTMLSpanElement;
      if (!testSpan) {
        return false;
      }

      return this.#isAttributesMatch(dom, op.attributes);
    }

    return dom instanceof Text;
  }

  // TODO: optimize this method
  #isAttributesMatch(
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

  #renderBlockTextContent(
    blockContainer: HTMLElement,
    textModel: BlockyTextModel
  ) {
    const contentContainer = this.#ensureContentContainerStyle(
      blockContainer,
      this.#contentContainer!
    );
    this.#leftPadRenderer?.render();

    let domPtr: Node | null = contentContainer.firstChild;
    let prevDom: Node | null = null;

    for (let i = 0, len = textModel.delta.ops.length; i < len; i++) {
      const op = textModel.delta.ops[i];
      if (!isString(op.insert)) {
        continue;
      }
      if (!domPtr) {
        domPtr = this.#createDomByOp(op, this.editor);
        contentContainer.insertBefore(domPtr, prevDom?.nextSibling ?? null);
      } else {
        // is old
        if (!this.#isNodeMatch(op, domPtr)) {
          const oldDom = domPtr;
          const newNode = this.#createDomByOp(op, this.editor);

          prevDom = domPtr;
          domPtr = domPtr.nextSibling;

          contentContainer.replaceChild(newNode, oldDom);
          continue;
        } else {
          clearNodeAttributes(domPtr);
          if (domPtr.textContent !== op.insert) {
            domPtr.textContent = op.insert;
          }
        }
      }

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
    this.#makeThisTextBlockIndent(prevElement);
  }

  #makeThisTextBlockIndent(prevElement: BlockyElement) {
    if (prevElement.nodeName !== TextBlock.Name) {
      return;
    }

    const textType = getTextTypeFromElement(prevElement);
    if (!textTypeCanIndent(textType)) {
      return;
    }

    const prevCursorState = this.editor.state.cursorState;

    const copy = this.props.clone();

    const change = new Changeset(this.editor.state);
    change.removeNode(this.props);

    const prevBlockyElement = prevElement as BlockElement;

    change.insertChildrenAfter(
      prevBlockyElement,
      [copy],
      prevBlockyElement.lastChild
    );

    change.setCursorState(prevCursorState);
    change.apply({
      refreshCursor: true,
    });
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

    const parentElement = this.props.parent! as BlockyElement;

    const copy = this.props.clone();
    let ptr = this.props.nextSibling;
    let deleteCount = 1;
    while (ptr) {
      copy.appendChild(ptr.clone());
      deleteCount++;
      ptr = ptr.nextSibling;
    }

    const change = new Changeset(this.editor.state);
    const index = parentElement.indexOf(this.props);
    change.deleteChildrenAt(parentElement, index, deleteCount);

    const parentOfParentBlockElement = parentBlockElement.parent!;
    change.insertChildrenAfter(
      parentOfParentBlockElement,
      [copy],
      parentBlockElement
    );

    change.setCursorState(prevCursorState);
    change.apply();
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
  name: string = TextBlock.Name;
  editable = true;

  onBlockCreated({ blockElement: data }: BlockCreatedEvent): Block {
    return new TextBlock(data);
  }

  onPaste({
    editorController,
    node: container,
    converter,
  }: BlockPasteEvent): BlockElement | undefined {
    return this.#getTextElementFromDOM(editorController, container, converter);
  }

  /**
   * Rebuild the data structure from the pasted html.
   */
  #getTextElementFromDOM(
    editorController: EditorController,
    node: HTMLElement,
    converter: HTMLConverter
  ): BlockElement {
    const newId = editorController.idGenerator.mkBlockId();

    const attributes = Object.create(null);
    const childrenContainer: BlockyNode[] = [];

    // TODO: Maybe using querySelector is slow.
    // Should make a benchmark here
    let textContentContainer = node.querySelector(".blocky-block-text-content");

    // if content container if not found, using the node directly
    if (!textContentContainer) {
      textContentContainer = node;
    }

    const delta = new Delta();
    if (textContentContainer) {
      let childPtr = textContentContainer.firstChild;

      const dataType = textContentContainer.getAttribute("data-type") || "0";
      const dataTypeInt = parseInt(dataType, 10);
      attributes.textType = dataTypeInt;

      while (childPtr) {
        if (childPtr instanceof Text) {
          delta.insert(normalizeString(childPtr.textContent));
        } else if (childPtr instanceof HTMLElement) {
          if (converter.isContainerElement(childPtr)) {
            const childElements = converter.parseContainerElement(childPtr);
            childrenContainer.push(...childElements);
          } else {
            const attributes = editorController.getAttributesBySpan(childPtr);
            delta.insert(normalizeString(childPtr.textContent), attributes);
          }
        }

        childPtr = childPtr.nextSibling;
      }
    } else {
      delta.insert(normalizeString(node.textContent));
    }
    const textModel = new BlockyTextModel(delta);

    const { tagName } = node;
    if (tagName === "H1") {
      attributes.textType = TextType.Heading1;
    } else if (tagName === "H2") {
      attributes.textType = TextType.Heading2;
    } else if (tagName === "H3") {
      attributes.textType = TextType.Heading3;
    } else if (tagName === "LI") {
      attributes.textType = TextType.Bulleted;
    }

    const childrenNode: BlockyNode[] = [];
    if (childrenContainer.length > 0) {
      childrenNode.push(...childrenContainer);
    }

    return new BlockElement(
      TextBlock.Name,
      newId,
      {
        ...attributes,
        textContent: textModel,
      },
      childrenNode
    );
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

export function getTextTypeForTextBlock(blockElement: BlockElement): TextType {
  return parseInt(blockElement.getAttribute("textType") || "0", 10);
}

// TODO: optimize
function normalizeString(content: string | null): string {
  if (content === null) {
    return "";
  }
  return content.replaceAll(/(\\r\\n|\t)/g, "");
}
