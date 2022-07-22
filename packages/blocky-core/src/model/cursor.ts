import { isUndefined } from "lodash-es";

export class CursorState {
  #isCollapsed: boolean | undefined;

  static collapse(id: string, offset: number): CursorState {
    return new CursorState(id, offset, id, offset, true);
  }

  constructor(
    readonly startId: string,
    readonly startOffset: number,
    readonly endId: string,
    readonly endOffset: number,
    collapsed?: boolean
  ) {
    this.#isCollapsed = collapsed;
  }

  get id() {
    return this.endId;
  }

  get offset() {
    return this.endOffset;
  }

  get isCollapsed() {
    if (isUndefined(this.#isCollapsed)) {
      this.#isCollapsed =
        this.startId === this.endId && this.startOffset === this.endOffset;
    }
    return this.#isCollapsed;
  }

  get isOpen() {
    return !this.isCollapsed;
  }
}
