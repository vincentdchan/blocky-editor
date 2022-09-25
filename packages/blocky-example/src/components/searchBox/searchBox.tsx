import { Component, createRef, JSX } from "preact";
import Button from "@pkg/components/button";
import { type EditorController } from "blocky-core";
import { type CursorState, CursorStateUpdateReason } from "blocky-data";
import "./searchBox.scss";

export interface SearchBoxProps {
  controller: EditorController;
  onClose?: () => void;
}

/**
 * The UI of searchbox
 *
 * This component will save the cursor state for you.
 * When the component will unmount, the saved cursor state
 * will be recovered.
 */
class SearchBox extends Component<SearchBoxProps> {
  #inputRef = createRef<HTMLInputElement>();
  #savedCursorState: CursorState | null = null;

  override componentDidMount(): void {
    window.requestAnimationFrame(() => {
      this.#inputRef.current?.focus();
    });
  }

  override componentWillUnmount(): void {
    window.requestAnimationFrame(() => {
      this.props.controller.editor?.state.__setCursorState(
        this.#savedCursorState,
        CursorStateUpdateReason.changeset
      );
    });
  }

  #handleInputFocus = () => {
    this.#savedCursorState =
      this.props.controller.editor?.state.cursorState ?? null;
  };

  #handleInputKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      this.props.onClose?.();
    }
  };

  override render(props: SearchBoxProps) {
    return (
      <div className="blocky-example-search-box">
        <input
          placeholder="Find"
          onKeyDown={this.#handleInputKeyDown}
          onFocus={this.#handleInputFocus}
          ref={this.#inputRef}
        />
        <div className="result-display">No results</div>
        <Button>{"<"}</Button>
        <Button>{">"}</Button>
        <Button onClick={props.onClose}>{"X"}</Button>
      </div>
    );
  }
}

export default SearchBox;
