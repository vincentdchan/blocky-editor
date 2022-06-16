import { elem } from "blocky-common/es/dom";
import {
  type IBlockDefinition,
  type BlockCreatedEvent,
  type BlockDidMountEvent,
  type BlockFocusedEvent,
  type BlockContentChangedEvent,
  Block,
} from "./basic";
import { type BlockData } from "@pkg/model";
import { TextModel, TextNode, type AttributesObject } from "@pkg/model/textModel";
import * as fastDiff from "fast-diff";
import { type Editor } from "@pkg/view/editor";
import { areEqualShallow } from "blocky-common/src/object";

export const TextBlockName = "text";

const TextContentClass = "blocky-block-text-content";

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

  constructor(private def: TextBlockDefinition, private data: BlockData) {
    super();
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

  protected findContentContainer(parent: HTMLElement) {
    return parent.firstChild! as HTMLElement;
  }

  override blockDidMount({ element }: BlockDidMountEvent): void {
    const content = elem("div", TextContentClass);

    const block = this.data.data as TextModel;
    const level = block.level;
    if (level === 1) {
      element.classList.add("blocky-heading1");
    } else if (level === 2) {
      element.classList.add("blocky-heading2");
    } else if (level === 3) {
      element.classList.add("blocky-heading3");
    }

    element.appendChild(content);
  }

  override blockFocused({ node: blockDom, selection, cursor }: BlockFocusedEvent): void {
    const contentContainer = this.findContentContainer(blockDom);

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

    return attributes;
  }

  /**
   * Convert DOM to [[FormattedTextSlice]]
   */
  private getFormattedTextSliceFromNode(index: number, node: Node): FormattedTextSlice {
    if (node instanceof HTMLSpanElement || node instanceof HTMLAnchorElement) {
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

    const blockData = this.data;
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
    const { id } = this.data;
    const blockNode = this.editor.state.idMap.get(id)!;
    const block = blockNode.data as BlockData<TextModel>;
    const textModel = block.data;
    if (!textModel) {
      return;
    }

    const contentContainer = this.findContentContainer(container);
    this.renderBlockTextContent(contentContainer, textModel);
  }

  private renderBlockTextContent(contentContainer: HTMLElement, textModel: TextModel) {
    let nodePtr = textModel.nodeBegin;
    let domPtr: Node | null = contentContainer.firstChild;
    let prevDom: Node | null = null;

    while (nodePtr) {
      if (!domPtr) {
        domPtr = createDomByNode(nodePtr, this.editor);
        contentContainer.insertBefore(domPtr, prevDom?.nextSibling ?? null);
      } else {  // is old
        if (!isNodeMatch(nodePtr, domPtr)) {
          const oldDom = domPtr;
          const newNode = createDomByNode(nodePtr, this.editor);

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

function createDomByNode(node: TextNode, editor: Editor): Node {
  if (node.attributes) {
    let d: HTMLElement;

    const { href, ...restAttr } = node.attributes;

    if (typeof href === "string") {
      d = elem("a");
      d.setAttribute("href", href);
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

function isNodeMatch(node: TextNode, dom: Node): boolean {
  if (node.attributes && dom instanceof HTMLSpanElement) {
    return true;
  }

  if (!node.attributes && node instanceof Text) {
    return true;
  }

  return false;
}

class TextBlockDefinition implements IBlockDefinition {
  public name: string = TextBlockName;
  public editable: boolean = true;

  onBlockCreated({ model: data }: BlockCreatedEvent): Block {
    return new TextBlock(this, data);
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
