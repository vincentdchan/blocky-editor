import { clearAllChildren, elem } from "blocky-common/es/dom";
import {
  type IBlockDefinition,
  type BlockCreatedEvent,
  type BlockDidMountEvent,
  type BlockFocusedEvent,
  type BlockContentChangedEvent,
  type BlockPasteEvent,
  Block,
} from "./basic";
import { type BlockData, TextType, CursorState } from "@pkg/model";
import { TextModel, TextNode, type AttributesObject } from "@pkg/model/textModel";
import * as fastDiff from "fast-diff";
import { type Editor } from "@pkg/view/editor";
import { areEqualShallow } from "blocky-common/src/object";
import { Position } from "blocky-common/src/position";

export const TextBlockName = "text";

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

function textModelToFormats(textModel: TextModel): FormattedTextSlice[] {
  const formats: FormattedTextSlice[] = [];

  let ptr = textModel.nodeBegin;
  let index: number = 0;
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

class TextBlock extends Block {
  #container: HTMLElement | undefined;

  constructor(private def: TextBlockDefinition, props: BlockData) {
    super(props);
  }

  override getBannerOffset(): Position {
    const blockData = this.props;
    const textModel = blockData.data as TextModel;

    if (textModel) {
      if (textModel.textType > 0) {
        return { x: 0, y: 12 };
      }

      if (textModel.textType === TextType.Normal) {
        return { x: 0, y: 2 };
      }

    }

    return { x: 0, y: 0 };
  }

  override findTextOffsetInBlock(focusedNode: Node, offsetInNode: number): number {
    const blockContainer = this.#container!;
    const contentContainer = this.findContentContainer!(blockContainer as HTMLElement);
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
    let ptr = parent.firstElementChild;

    while (ptr) {
      if (ptr.classList.contains(TextContentClass)) {
        return ptr as HTMLElement;
      }
      ptr = ptr.nextElementSibling;
    }

    throw new Error("content not found");
  }

  private createContentContainer(): HTMLElement {
    const e = elem("div", TextContentClass);
    e.setAttribute("placeholder", zeroSpaceEmptyChar)
    return e;
  }

  override blockDidMount({ element }: BlockDidMountEvent): void {
    const content = this.createContentContainer();
    element.appendChild(content);
  }

  override blockFocused({ node: blockDom, selection, cursor }: BlockFocusedEvent): void {
    const contentContainer = this.findContentContainer(blockDom);

    contentContainer.setAttribute("placeholder", "Empty content")

    const { offset } = cursor;
    const pos = this.findFocusPosition(blockDom, offset);
    if (!pos) {
      const { firstChild } = contentContainer;

      if (firstChild == null) {
        setRangeIfDifferent(selection, contentContainer, 0, contentContainer, 0);
        return;
      }

      setRangeIfDifferent(selection, firstChild, 0, firstChild, 0);
    } else {
      const { node, offset } = pos;
      setRangeIfDifferent(selection, node, offset, node, offset);
    }
  }

  override blockBlur({ node: blockDom }: BlockFocusedEvent): void {
    const contentContainer = this.findContentContainer(blockDom);
    const zeroSpaceEmptyChar = String.fromCharCode(160);
    contentContainer.setAttribute("placeholder", zeroSpaceEmptyChar)
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
          node = node.firstChild
        }
        return { node, offset: absoluteOffset };
      } else {
        absoluteOffset -= contentLength;
      }

      ptr = ptr.nextSibling;
    }

    return;
  }

  private getAttributeObjectFromElement(element: HTMLElement): AttributesObject {
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
  private getFormattedTextSliceFromNode(index: number, node: Node): FormattedTextSlice {
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

  override blockContentChanged({ node, offset }: BlockContentChangedEvent): void {
    const contentContainer = this.findContentContainer(node);
    const formats: FormattedTextSlice[] = [];

    let textContent = "";

    const blockData = this.props;
    let ptr = contentContainer.firstChild;
    let idx = 0;
    while (ptr) {
      const format = this.getFormattedTextSliceFromNode(idx, ptr);
      formats.push(format);

      idx += ptr.textContent?.length ?? 0;
      textContent += ptr.textContent;
      ptr = ptr.nextSibling;
    }

    const textModel = blockData.data as TextModel;
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
        index -= content.length;
      }
    }

    this.diffAndApplyFormats(formats, textModel);
  }

  private diffAndApplyFormats(newFormats: FormattedTextSlice[], textModel: TextModel) {
    const oldFormats: FormattedTextSlice[] = textModelToFormats(textModel);

    const slices: (FormattedTextSlice | undefined)[] = Array(textModel.length);
    
    for (const format of newFormats) {
      slices[format.index] = format;
    }

    for (const oldFormat of oldFormats) {
      const f = slices[oldFormat.index];
      if (!f) {  // format doesn't anymore, erase it.
        textModel.format(oldFormat.index, oldFormat.length, undefined);
        continue;
      }

      if (!areEqualShallow(f.attributes, oldFormat.attributes)) {
        if (oldFormat.length !== f.length) {  // length are different, erase it firstly
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
    const { id } = this.props;
    const blockNode = this.editor.state.idMap.get(id)!;
    const block = blockNode.data as BlockData<TextModel>;
    const textModel = block.data;
    if (!textModel) {
      return;
    }

    const contentContainer = this.findContentContainer(container);
    this.renderBlockTextContent(contentContainer, textModel);
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

  private ensureContentContainerStyle(contentContainer: HTMLElement, textModel: TextModel): HTMLElement {
    const renderedType = contentContainer.getAttribute("data-type");
    const { textType } = textModel;

    const forceRenderContentStyle = (parent: HTMLElement, contentContainer: HTMLElement, textType: TextType) => {
      switch (textType) {
        case TextType.Bulleted: {
          const bulletSpan = this.createBulletSpan();
          parent.insertBefore(bulletSpan, contentContainer);

          contentContainer.classList.add("blocky-bulleted");
          break;
        }

        case TextType.Heading1:
        case TextType.Heading2:
        case TextType.Heading3:
          contentContainer.classList.add(`blocky-heading${textType}`);
          break;
        
        default: {}

      }

      contentContainer.setAttribute("data-type", textType.toString());
    }

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

  private renderBlockTextContent(contentContainer: HTMLElement, textModel: TextModel) {
    contentContainer = this.ensureContentContainerStyle(contentContainer, textModel);

    let nodePtr = textModel.nodeBegin;
    let domPtr: Node | null = contentContainer.firstChild;
    let prevDom: Node | null = null;

    while (nodePtr) {
      if (!domPtr) {
        domPtr = this.createDomByNode(nodePtr, this.editor);
        contentContainer.insertBefore(domPtr, prevDom?.nextSibling ?? null);
      } else {  // is old
        if (!isNodeMatch(nodePtr, domPtr)) {
          const oldDom = domPtr;
          const newNode = this.createDomByNode(nodePtr, this.editor);

          nodePtr = nodePtr.next;
          prevDom = domPtr;
          domPtr = domPtr.nextSibling;

          contentContainer.replaceChild(newNode, oldDom);
          continue;
        } else if (domPtr.textContent !== nodePtr.content) {
          domPtr.textContent = nodePtr.content;
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

}

function isNodeMatch(node: TextNode, dom: Node): boolean {
  if (node.attributes) {
    if (typeof node.attributes.href === "string") {
      return dom instanceof HTMLElement && typeof dom.getAttribute(DataRefKey) === "string";
    }
    return dom instanceof HTMLSpanElement;
  }

  return node instanceof Text;
}

class TextBlockDefinition implements IBlockDefinition {
  public name: string = TextBlockName;
  public editable: boolean = true;

  onBlockCreated({ model: data }: BlockCreatedEvent): Block {
    return new TextBlock(this, data);
  }

  onPaste({ after: cursorState, node: container, editor }: BlockPasteEvent): CursorState | undefined {
    if (!cursorState) {
      return;
    }

    if (cursorState.type === "open") {
      return;
    }

    const currentNode = editor.state.idMap.get(cursorState.targetId)!;
    const parentId = currentNode.parent!.data.id;

    const newId = editor.idGenerator.mkBlockId();

    const textModel = this.getTextModelFromDOM(editor, container);

    editor.applyActions([{
      type: "new-block",
      targetId: parentId,
      afterId: cursorState.targetId,
      newId,
      blockName: "text",
      data: textModel,
    }], true);

    return {
      type: "collapsed",
      targetId: newId,
      offset: 0,
    };
  }

  /**
   * Rebuild the data structure from the pasted html.
   */
  private getTextModelFromDOM(editor: Editor, node: HTMLElement): TextModel {
    const result = new TextModel();

    // TODO: Maybe using querySelector is slow.
    // Should make a benchmark here
    let textContentContainer = node.querySelector(".blocky-block-text-content");

    // if content container if not found, using the node directly
    if (!textContentContainer) {
      textContentContainer = node;
    }

    let index: number = 0;
    if (textContentContainer) {
      let childPtr = textContentContainer.firstChild;

      const dataType = textContentContainer.getAttribute("data-type") || "0";
      const dataTypeInt = parseInt(dataType, 10);
      result.textType = dataTypeInt;

      while (childPtr) {
        if (childPtr instanceof Text) {
          const content = childPtr.textContent ?? "";
          result.insert(index, content);
          index += content.length;
        } else if (childPtr instanceof HTMLElement) {
          const content = childPtr.textContent ?? "";
          const attributes = editor.getAttributesBySpan(childPtr);
          result.insert(index, content, attributes);
          index += content.length;
        }

        childPtr = childPtr.nextSibling;
      }

    } else {
      result.insert(0, node.textContent ?? "");
    }

    const { tagName } = node;
    if (tagName === "H1") {
      result.textType = TextType.Heading1;
    } else if (tagName === "H2") {
      result.textType = TextType.Heading2;
    } else if (tagName === "H3") {
      result.textType = TextType.Heading3;
    } else if (tagName === "LI") {
      result.textType = TextType.Bulleted;
    }

    return result;
  }

}

function setRangeIfDifferent (
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
