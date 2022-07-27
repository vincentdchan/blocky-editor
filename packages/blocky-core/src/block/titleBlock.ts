import Delta from "quill-delta-es";
import {
  type BlockContentChangedEvent,
  type BlockDidMountEvent,
  Block,
} from "./basic";
import { TextInputEvent } from "@pkg/view/editor";
import { BlockyTextModel, BlockElement } from "@pkg/model";

export class TitleBlock extends Block {
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

  override blockDidMount({ element }: BlockDidMountEvent): void {
    this.#container = element;
  }

  get textModel(): BlockyTextModel {
    return this.props.getAttribute<BlockyTextModel>("textContent")!;
  }
}
