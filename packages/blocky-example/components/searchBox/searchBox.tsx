import React, { Component, createRef } from "react";
import Button from "@pkg/components/button";
import {
  type EditorController,
  type SearchContext,
  type CursorState,
  CursorStateUpdateReason,
} from "blocky-core";
import { debounce } from "lodash-es";
import "./searchBox.scss";

export interface SearchBoxProps {
  controller: EditorController;
  onClose?: () => void;
}

interface SearchBoxState {
  searchContent: string;
  currentIndex: number;
  totalCount: number;
}

/**
 * The UI of searchbox
 *
 * This component will save the cursor state for you.
 * When the component will unmount, the saved cursor state
 * will be recovered.
 */
class SearchBox extends Component<SearchBoxProps, SearchBoxState> {
  #inputRef = createRef<HTMLInputElement>();
  #savedCursorState: CursorState | null = null;
  #searchContext: SearchContext | undefined;

  constructor(props: SearchBoxProps) {
    super(props);
    this.state = {
      searchContent: "",
      currentIndex: 0,
      totalCount: 0,
    };
  }

  override componentDidMount(): void {
    window.requestAnimationFrame(() => {
      this.#inputRef.current?.focus();
    });
  }

  override componentDidUpdate(
    previousProps: Readonly<SearchBoxProps>,
    previousState: Readonly<SearchBoxState>
  ): void {
    if (previousState.currentIndex !== this.state.currentIndex) {
      this.#searchContext?.setActiveIndex(this.state.currentIndex);
    }
  }

  /**
   * Restore the cursor state
   */
  override componentWillUnmount(): void {
    window.requestAnimationFrame(() => {
      this.props.controller.editor?.state.__setCursorState(
        this.#savedCursorState,
        CursorStateUpdateReason.changeset
      );
    });
    this.#searchContext?.dispose();
    this.#searchContext = undefined;
  }

  #handleInputFocus = () => {
    this.#savedCursorState =
      this.props.controller.editor?.state.cursorState ?? null;
  };

  #handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      this.props.onClose?.();
    } else if (e.key === "Enter") {
      if (this.state.currentIndex === this.state.totalCount - 1) {
        this.setState({
          currentIndex: 0,
        });
      } else {
        this.#emitNext();
      }
    }
  };

  #handleInputChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState(
      {
        searchContent: (e.target as HTMLInputElement).value,
      },
      () => this.#searchContent()
    );
  };

  #resultMessage() {
    const { currentIndex, totalCount } = this.state;
    if (totalCount === 0) {
      return "No results";
    }
    return `${currentIndex + 1} of ${totalCount}`;
  }

  #searchContent = debounce(() => {
    const { editor } = this.props.controller;
    if (!editor) {
      return;
    }
    this.#searchContext = editor.createSearchContext(this.state.searchContent);
    const totalCount = this.#searchContext.contexts.length;
    const currentIndex = Math.max(
      Math.min(totalCount - 1, this.state.currentIndex),
      0
    );
    this.setState({
      totalCount,
      currentIndex,
    });
  }, 200);

  #prevDisabled() {
    return this.state.currentIndex <= 0;
  }

  #nextDisabled() {
    return this.state.currentIndex >= this.state.totalCount - 1;
  }

  #emitPrev = () => {
    const currentIndex = Math.max(this.state.currentIndex - 1, 0);
    this.setState({ currentIndex });
  };

  #emitNext = () => {
    const currentIndex = Math.min(
      this.state.currentIndex + 1,
      this.state.totalCount - 1
    );
    this.setState({ currentIndex });
  };

  override render() {
    return (
      <div className="blocky-example-search-box">
        <input
          placeholder="Find"
          onKeyDown={this.#handleInputKeyDown}
          onFocus={this.#handleInputFocus}
          onChange={this.#handleInputChanged}
          value={this.state.searchContent}
          ref={this.#inputRef}
        />
        <div className="result-display">{this.#resultMessage()}</div>
        <Button onClick={this.#emitPrev} disabled={this.#prevDisabled()}>
          {"<"}
        </Button>
        <Button onClick={this.#emitNext} disabled={this.#nextDisabled()}>
          {">"}
        </Button>
        <Button onClick={this.props.onClose}>{"X"}</Button>
      </div>
    );
  }
}

export default SearchBox;
