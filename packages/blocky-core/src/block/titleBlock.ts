import Delta from "quill-delta-es";
import {
  type IBlockDefinition,
  type BlockCreatedEvent,
  type BlockFocusedEvent,
  type BlockContentChangedEvent,
  type BlockDidMountEvent,
  type CursorDomResult,
  Block,
} from "./basic";
import { TextInputEvent } from "@pkg/view/editor";
import { BlockyTextModel, BlockElement } from "@pkg/model";

export class TitleBlock extends Block {
  static Name = "Title";
  #container: HTMLElement | undefined;

  constructor(props: BlockElement) {
    super(props);
  }

  override blockContentChanged({
    changeset,
    offset,
    blockElement,
  }: BlockContentChangedEvent): void {
    if (!this.#container) {
      return;
    }
    const newDelta = new Delta([{ insert: this.#container.textContent ?? "" }]);

    const beforeDelta = this.textModel.delta;

    const diff = beforeDelta.diff(newDelta, offset);
    changeset.textEdit(this.props, "textContent", () => diff);

    this.editor.textInput.emit(
      new TextInputEvent(beforeDelta, diff, blockElement)
    );
  }

  override blockFocused({ cursor, selection }: BlockFocusedEvent) {
    const range = document.createRange();

    const firstChild = this.#container?.firstChild;
    if (!firstChild) {
      return;
    }

    range.setStart(firstChild, cursor.offset);
    range.setEnd(firstChild, cursor.offset);
    selection.addRange(range);
  }

  override getCursorDomByOffset(offset: number): CursorDomResult | undefined {
    const firstChild = this.#container?.firstChild;
    if (!firstChild) {
      return undefined;
    }
    return {
      node: firstChild,
      offset,
    };
  }

  override blockDidMount({ element }: BlockDidMountEvent): void {
    this.#container = element;
  }

  get textModel(): BlockyTextModel {
    return this.props.getAttribute<BlockyTextModel>("textContent")!;
  }
}

export class TitleBlockDefinition implements IBlockDefinition {
  name: string = TitleBlock.Name;
  editable = true;

  onBlockCreated({ blockElement: data }: BlockCreatedEvent): Block {
    return new TitleBlock(data);
  }
}
