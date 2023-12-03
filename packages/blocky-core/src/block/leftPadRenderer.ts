import { elem, removeNode } from "blocky-common/es/dom";
import { EditorState } from "@pkg/model";
import { BlockDataElement, Changeset } from "@pkg/data";
import { Subject, fromEvent, takeUntil } from "rxjs";

export class LeftPadRenderer {
  readonly dispose$ = new Subject<void>();
  constructor(readonly container: HTMLDivElement) {}
  render() {}
  dispose(): void {
    this.dispose$.next();
    removeNode(this.container);
  }
}
const checkedColor = "rgb(240, 153, 56)";
export class CheckboxRenderer extends LeftPadRenderer {
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
