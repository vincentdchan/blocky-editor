import { isNumber, isObject, isString } from "lodash-es";
import { elem, removeNode } from "blocky-common/es/dom";
import { removeLineBreaks, type Position } from "blocky-common/es";
import {
  type BlockDidMountEvent,
  type BlockFocusedEvent,
  type BlockContentChangedEvent,
  type BlockPasteEvent,
  type CursorDomResult,
  Block,
} from "./basic";
import { EditorState } from "@pkg/model";
import {
  type AttributesObject,
  BlockyTextModel,
  DataBaseElement,
  DataBaseNode,
  BlockDataElement,
  Changeset,
  TextType,
  textTypePrecedence,
} from "@pkg/data";
import Delta, { Op } from "quill-delta-es";
import { TextInputEvent, type Editor } from "@pkg/view/editor";
import { HTMLConverter } from "@pkg/helper/htmlConverter";
import { EditorController } from "@pkg/view/controller";
import type { SpanStyle } from "@pkg/registry/spanRegistry";
import type { Embed } from "@pkg/registry/embedRegistry";
import { Subject, fromEvent, takeUntil } from "rxjs";

const TextContentClass = "blocky-block-text-content";

const DataRefKey = "data-href";

const zeroSpaceEmptyChar = String.fromCharCode(160);

interface TextPosition {
  node: Node;
  offset: number;
}

function textTypeCanIndent(textType: TextType): boolean {
  return textType === TextType.Normal || textType === TextType.Bulleted;
}

class LeftPadRenderer {
  readonly dispose$ = new Subject<void>();
  constructor(readonly container: HTMLDivElement) {}
  render() {}
  dispose(): void {
    this.dispose$.next();
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
    private blockElement: BlockDataElement
  ) {
    super(container);
    this.#checkboxContainer = elem("div", "blocky-checkbox");
    container.append(this.#checkboxContainer);

    this.#centerElement = elem("div", "blocky-checkbox-center");
    this.#centerElement.style.backgroundColor = checkedColor;
    this.#checkboxContainer.appendChild(this.#centerElement);
    this.#centerElement.style.visibility = "hidden";
    this.#checkboxContainer.style.boxShadow = `0px 0px 0px 1px gray`;

    fromEvent(this.#checkboxContainer, "click")
      .pipe(takeUntil(this.dispose$))
      .subscribe(this.#handleClick);
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
  static Editable = true;

  static OnPaste({
    editorController,
    node: container,
    converter,
  }: BlockPasteEvent): BlockDataElement | undefined {
    return TextBlock.#getTextElementFromDOM(
      editorController,
      container,
      converter
    );
  }

  /**
   * Rebuild the data structure from the pasted html.
   */
  static #getTextElementFromDOM(
    editorController: EditorController,
    node: HTMLElement,
    converter: HTMLConverter
  ): BlockDataElement {
    const newId = editorController.idGenerator.mkBlockId();

    const attributes = Object.create(null);
    const childrenContainer: DataBaseNode[] = [];

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

      const dataType =
        textContentContainer.getAttribute("data-type") || TextType.Normal;
      attributes.textType = dataType;

      while (childPtr) {
        if (childPtr instanceof Text) {
          delta.insert(removeLineBreaks(childPtr.textContent));
        } else if (childPtr instanceof HTMLElement) {
          if (converter.isContainerElement(childPtr)) {
            const childElements = converter.parseContainerElement(childPtr);
            childrenContainer.push(...childElements);
          } else {
            const attributes = editorController.getAttributesBySpan(childPtr);
            delta.insert(removeLineBreaks(childPtr.textContent), attributes);
          }
        }

        childPtr = childPtr.nextSibling;
      }
    } else {
      delta.insert(removeLineBreaks(node.textContent));
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

    const childrenNode: DataBaseNode[] = [];
    if (childrenContainer.length > 0) {
      childrenNode.push(...childrenContainer);
    }

    return new BlockDataElement(
      TextBlock.Name,
      newId,
      {
        ...attributes,
        textContent: textModel,
      },
      childrenNode
    );
  }

  #container: HTMLElement | undefined;
  #bodyContainer: HTMLElement | null = null;
  #contentContainer: HTMLElement | null = null;
  #leftPadRenderer: LeftPadRenderer | null = null;
  #embeds: Set<Embed> = new Set();

  private getTextType(): TextType {
    return getTextTypeForTextBlock(this.elementData as BlockDataElement);
  }

  private getNumber(): number | undefined {
    const elem = this.elementData as BlockDataElement;
    return elem.getAttribute<number | undefined>("num");
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

  override getSpannerOffset(): Position {
    const textType = this.getTextType();
    const precedence = textTypePrecedence(textType);

    if (precedence > 0) {
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
      counter += this.#contentLengthOfNode(ptr);
      ptr = ptr.nextSibling;
    }

    return counter + offsetInNode;
  }

  #contentLengthOfNode(node: Node): number {
    if (node instanceof HTMLSpanElement && node.contentEditable === "false") {
      return 1;
    }
    return node.textContent?.length ?? 0;
  }

  #createContentContainer(): HTMLElement {
    const e = elem("div", TextContentClass);
    e.setAttribute("placeholder", zeroSpaceEmptyChar);
    return e;
  }

  #createTextBodyContainer(): HTMLElement {
    const e = elem("div", "blocky-text-body");
    return e;
  }

  protected findContentContainer(): HTMLElement {
    const e = this.#contentContainer;
    if (!e) {
      throw new Error("content not found");
    }
    return e;
  }

  override blockDidMount({ element }: BlockDidMountEvent): void {
    element.classList.add("blocky-flex");

    this.#bodyContainer = this.#createTextBodyContainer();

    this.#contentContainer = this.#createContentContainer();
    this.#bodyContainer.append(this.#contentContainer);

    element.appendChild(this.#bodyContainer);
  }

  override blockFocused({ selection, cursor }: BlockFocusedEvent): void {
    const contentContainer = this.findContentContainer();

    const emptyPlaceholder = this.editor.controller.emptyPlaceholder;
    contentContainer.setAttribute("placeholder", emptyPlaceholder);

    const { offset } = cursor;
    const pos = this.#findFocusPosition(offset);
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

    return this.#findFocusPosition(offset);
  }

  override blockBlur(): void {
    const contentContainer = this.findContentContainer();
    const zeroSpaceEmptyChar = String.fromCharCode(160);
    contentContainer.setAttribute("placeholder", zeroSpaceEmptyChar);
  }

  #findFocusPosition(absoluteOffset: number): TextPosition | undefined {
    const contentContainer = this.findContentContainer();
    let ptr = contentContainer.firstChild;

    while (ptr) {
      const contentLength = this.#contentLengthOfNode(ptr);
      if (absoluteOffset <= contentLength) {
        let node = ptr;
        if (node instanceof HTMLSpanElement) {
          // the cursor is in the embed, return the next
          if (node.contentEditable === "false") {
            const next = node.nextSibling;
            if (!next) {
              return undefined;
            }
            return { node: next, offset: 0 };
          }
          if (node.firstChild) {
            node = node.firstChild;
          }
        }
        return { node, offset: absoluteOffset };
      } else {
        absoluteOffset -= contentLength;
      }

      ptr = ptr.nextSibling;
    }

    return;
  }

  #getAttributeObjectFromElement(element: HTMLElement): AttributesObject {
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
  #getFormattedTextSliceFromNode(newDelta: Delta, node: Node) {
    const content = node.textContent ?? "";
    if (node instanceof HTMLSpanElement) {
      if (node.contentEditable === "false") {
        const embedNode: Embed = node._mgEmbed;
        if (embedNode) {
          newDelta.insert(embedNode.record);
        }
      } else {
        const attributes = this.#getAttributeObjectFromElement(node);
        newDelta.insert(content, attributes);
      }
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
      this.#getFormattedTextSliceFromNode(newDelta, ptr);
      ptr = ptr.nextSibling;
    }

    const beforeDelta = this.textModel.delta;

    try {
      const diff = beforeDelta.diff(newDelta, offset);
      changeset.textEdit(this.props, "textContent", () => diff);

      this.editor.addStagedInput(
        new TextInputEvent(beforeDelta, diff, blockElement)
      );
    } catch (err: unknown) {
      console.error(
        `[Blocky] diff error ${err}, before:`,
        beforeDelta,
        " new: ",
        newDelta
      );
      this.editor.controller.options?.onError?.(err);
    }
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
    this.#checkEmbed();
  }

  override renderChildren(): DataBaseNode | void | null {
    return this.props.firstChild;
  }

  #checkEmbed() {
    const embeds = [...this.#embeds];
    for (const embed of embeds) {
      const { container } = embed;
      if (container && container.parentNode === null) {
        this.#embeds.delete(embed);
        embed.dispose?.();
      }
    }
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
            this.#applyStyleOnSpan(d, style);
          }
        }
      }

      return d;
    }
    return document.createTextNode(op.insert! as string);
  }

  #applyStyleOnSpan(element: HTMLElement, spanStyle: SpanStyle) {
    if (isString(spanStyle.className)) {
      element.classList.add(spanStyle.className);
    }
    spanStyle.onSpanCreated?.(element);
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

  #createNumberRenderer(): LeftPadRenderer {
    const container = this.#createLeftPadContainer();

    const num = this.getNumber();

    const numberContent = elem("div", "blocky-number-content");

    if (isNumber(num)) {
      numberContent.style.setProperty("--pseudoBefore--content", `"${num}."`);
    }

    container.appendChild(numberContent);

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
    contentContainer.setAttribute("data-type", textType);
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

      case TextType.Numbered: {
        this.#leftPadRenderer = this.#createNumberRenderer();
        blockContainer.insertBefore(
          this.#leftPadRenderer.container,
          blockContainer.firstChild
        );
        return;
      }

      case TextType.Heading1:
      case TextType.Heading2:
      case TextType.Heading3: {
        contentContainer.classList.add(`blocky-${textType}`);
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

    if (renderedType !== textType) {
      this.#bodyContainer?.removeChild(this.#contentContainer!);

      const newContainer = this.#createContentContainer();
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

  #isSpanNodeMatch(op: Op, dom: Node): boolean {
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
      let thisNode: Node | null = null;
      if (isString(op.insert)) {
        thisNode = this.#renderTextSpanByOp(
          domPtr,
          prevDom,
          contentContainer,
          op
        );
      } else if (isObject(op.insert)) {
        thisNode = this.#renderEmbedByOp(domPtr, prevDom, contentContainer, op);
        if (i === len - 1) {
          // the last element of the delta is an embed, the next must be a '\n'
          let appendEnding = false;
          const next = thisNode?.nextSibling;
          if (next === null) {
            appendEnding = true;
          }

          if (next && next.textContent !== "\n") {
            contentContainer.removeChild(next);
          }

          if (appendEnding) {
            const ending = document.createTextNode("\n");
            contentContainer.appendChild(ending);
          }

          prevDom = thisNode;
          domPtr = null;
          break;
        }
      }

      prevDom = thisNode;
      domPtr = thisNode?.nextSibling ?? null;
    }

    // remove remaining text
    while (domPtr) {
      const next = domPtr.nextSibling;
      domPtr.parentNode?.removeChild(domPtr);

      domPtr = next;
    }
  }

  // return this element
  #renderTextSpanByOp(
    domPtr: Node | null,
    prevDom: Node | null,
    contentContainer: HTMLElement,
    op: Op
  ): Node | null {
    if (!domPtr) {
      domPtr = this.#createDomByOp(op, this.editor);
      if (!prevDom) {
        contentContainer.insertBefore(domPtr, contentContainer.firstChild);
      } else {
        contentContainer.insertBefore(domPtr, prevDom?.nextSibling ?? null);
      }
    } else {
      // is old
      if (!this.#isSpanNodeMatch(op, domPtr)) {
        const oldDom = domPtr;
        const newNode = this.#createDomByOp(op, this.editor);

        prevDom = domPtr;
        contentContainer.replaceChild(newNode, oldDom);

        domPtr = newNode;
      } else {
        clearNodeAttributes(domPtr);
        if (domPtr.textContent !== op.insert) {
          domPtr.textContent = op.insert as string;
        }
      }
    }
    return domPtr;
  }

  #renderEmbedByOp(
    domPtr: Node | null,
    prevDom: Node | null,
    contentContainer: HTMLElement,
    op: Op
  ): Node | null {
    if (!domPtr || !this.#domMatchEmbedStruct(op, domPtr)) {
      domPtr = this.#createEmbedDomByOp(op, this.editor);
      if (!prevDom) {
        contentContainer.insertBefore(domPtr, contentContainer.firstChild);
      } else {
        contentContainer.insertBefore(domPtr, prevDom?.nextSibling ?? null);
      }
    }
    return domPtr;
  }

  #domMatchEmbedStruct(op: Op, domPtr: Node): boolean {
    if (!(domPtr instanceof HTMLSpanElement)) {
      return false;
    }
    if (domPtr.contentEditable !== "false") {
      return false;
    }
    if (!isObject(op.insert) || !isString(op.insert.type)) {
      return false;
    }
    const dataType = domPtr.getAttribute("data-type");
    return op.insert.type === dataType;
  }

  #createEmbedDomByOp(op: Op, editor: Editor): Node {
    const embedContainer = elem("span");
    embedContainer.contentEditable = "false";
    fromEvent<MouseEvent>(embedContainer, "click")
      .pipe(takeUntil(this.dispose$))
      .subscribe((evt: MouseEvent) => {
        evt.preventDefault();
        // TODO: upload the event
        // restore the selection
      });
    embedContainer.appendChild(this.#createNoWrapSpan());

    const embed = elem("span");
    embedContainer.appendChild(embed);

    const record = op.insert as Record<string, unknown>;
    const type = record.type as string;

    if (isString(type)) {
      embedContainer.setAttribute("data-type", type);
    }

    const embedDef = editor.controller.embedRegistry.embeds.get(type);
    let embedNode: Embed | undefined | void;
    if (!embedDef) {
      console.error("Can not find embed type ", type);
      embed.textContent = "Undefined";
    } else {
      embedNode = new embedDef({
        element: embed,
        container: embedContainer,
        record,
      });
      if (embedNode) {
        embedNode.container = embedContainer;
      }
    }

    embedContainer.setAttribute("data-type", type);
    embedContainer.appendChild(this.#createNoWrapSpan());

    this.#embeds.add(embedNode!);
    embedContainer._mgEmbed = embedNode;
    return embedContainer;
  }

  #createNoWrapSpan(): HTMLSpanElement {
    const result = elem("span");
    result.style.whiteSpace = "nowrap";
    return result;
  }

  override onIndent(): void {
    const prevElement = this.props.prevSibling as BlockDataElement | undefined;
    if (!prevElement) {
      return;
    }
    this.#makeThisTextBlockIndent(prevElement);
  }

  #makeThisTextBlockIndent(prevElement: BlockDataElement) {
    if (prevElement.t !== TextBlock.Name) {
      return;
    }

    const textType = getTextTypeForTextBlock(prevElement);
    if (!textTypeCanIndent(textType)) {
      return;
    }

    const prevCursorState = this.editor.state.cursorState;

    const copy = this.props.clone();

    const change = new Changeset(this.editor.state);
    change.removeNode(this.props);

    const prevBlockyElement = prevElement as BlockDataElement;

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
    const parentBlockElement = this.#findParentBlockElement();
    if (!parentBlockElement) {
      return;
    }

    const prevCursorState = this.editor.state.cursorState;

    const parentElement = this.props.parent! as DataBaseElement;

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

  #findParentBlockElement(): BlockDataElement | undefined {
    let result = this.props.parent;

    while (result) {
      if (result instanceof BlockDataElement) {
        return result;
      }

      result = result.parent;
    }
  }

  override dispose(): void {
    for (const embed of this.#embeds) {
      embed.dispose?.();
    }
    this.#embeds.clear();

    this.#leftPadRenderer?.dispose();
    this.#leftPadRenderer = null;

    super.dispose();
  }
}

function clearNodeAttributes(node: Node) {
  if (node instanceof HTMLSpanElement && node.style.length !== 0) {
    node.setAttribute("style", "");
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

export function getTextTypeForTextBlock(
  blockElement: BlockDataElement
): TextType {
  return blockElement.getAttribute("textType") ?? TextType.Normal;
}
