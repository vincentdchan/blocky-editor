import { BlockDataElement, Editor, IPlugin, PluginContext } from "../..";
import { take, takeUntil, fromEvent } from "rxjs";
import { SpannerDelegate, SpannerFactory } from "./spannerDelegate";
import { type Position } from "blocky-common/es";

const defaultWidth = 48;

export interface SpannerPluginOptions {
  factory: SpannerFactory;
  width?: number;
  mountPoint?: HTMLElement;
}

export class SpannerPlugin implements IPlugin {
  deletage: SpannerDelegate | undefined;
  name = "spanner";

  constructor(readonly options: SpannerPluginOptions) {}

  get container(): HTMLElement | undefined {
    return this.options.mountPoint ?? this.deletage?.editor.container;
  }

  onInitialized(context: PluginContext): void {
    const { editor, dispose$ } = context;
    this.deletage = new SpannerDelegate(editor, this.options.factory);

    const container = this.options.mountPoint ?? editor.container;
    this.deletage.mount(container);

    editor.placeSpannerAt$
      .pipe(takeUntil(dispose$))
      .subscribe(({ blockContainer, node }) => {
        this.placeSpannerAt(editor, blockContainer, node);
      });

    fromEvent(container, "mouseleave")
      .pipe(takeUntil(dispose$))
      .subscribe(() => {
        this.deletage?.hide();
      });

    dispose$.pipe(take(1)).subscribe(() => {
      this.deletage?.dispose();
      this.deletage = undefined;
    });
  }

  protected placeSpannerAt(
    editor: Editor,
    blockContainer: HTMLElement,
    node: BlockDataElement
  ) {
    if (!this.deletage) {
      return;
    }
    const block = editor.state.blocks.get(node.id);
    if (!block) {
      return;
    }
    let { x, y } = this.getRelativeOffsetByDom(blockContainer);
    const offset = block.getSpannerOffset();
    x += offset.x;
    y += offset.y;
    x -= this.width;
    this.deletage.focusedNode = node;
    this.deletage.show();
    this.deletage.setPosition(x, y);
  }

  get width(): number {
    return this.options.width ?? defaultWidth;
  }

  /**
   * Get the element's relative position to the container of the editor.
   */
  protected getRelativeOffsetByDom(element: HTMLElement): Position {
    const container = this.container;
    if (!container) {
      return { x: 0, y: 0 };
    }
    const containerRect = container.getBoundingClientRect();
    const blockRect = element.getBoundingClientRect();
    return {
      x: blockRect.x - containerRect.x,
      y: blockRect.y - containerRect.y,
    };
  }
}
