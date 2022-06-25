import { Slot } from "blocky-common/es/events";
import { observe } from "blocky-common/es/observable";
import { type Padding } from "blocky-common/es/dom";
import {
  AttributesObject,
  State,
  BlockyElement,
  type CursorState,
  BlockyTextModel,
} from "@pkg/model";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { PluginRegistry, type IPlugin } from "@pkg/registry/pluginRegistry";
import { SpanRegistry } from "@pkg/registry/spanRegistry";
import { MarkupGenerator } from "@pkg/model/markup";
import { type BannerFactory } from "@pkg/view/bannerDelegate";
import { type ToolbarFactory } from "@pkg/view/toolbarDelegate";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { type Editor } from "./editor";
import { type BlockElement } from "@pkg/block/basic";

export interface IEditorControllerOptions {
  pluginRegistry?: PluginRegistry;

  /**
   *
   * Specify the plugins.
   * The plugins will be loaded by the editor
   *
   */
  plugins?: IPlugin[];

  spanRegistry?: SpanRegistry;
  blockRegistry?: BlockRegistry;
  state?: State;
  idGenerator?: IdGenerator;
  bannerFactory?: BannerFactory;
  toolbarFactory?: ToolbarFactory;

  /**
   * The inner padding of the editor
   */
  padding?: Partial<Padding>;

  bannerXOffset?: number;
}

export interface IInsertOptions {
  autoFocus?: boolean;
  noRender?: boolean;
}

export type NextTickFn = () => void;

export class EditorController {
  #nextTick: NextTickFn[] = [];

  public editor: Editor | undefined;
  public readonly pluginRegistry: PluginRegistry;
  public readonly spanRegistry: SpanRegistry;
  public readonly blockRegistry: BlockRegistry;
  public readonly idGenerator: IdGenerator;
  public readonly m: MarkupGenerator;
  public readonly state: State;
  public readonly cursorChanged: Slot<CursorState | undefined> = new Slot();

  /**
   * A class to control the behavior in the editor
   */
  constructor(public options?: IEditorControllerOptions) {
    this.pluginRegistry =
      options?.pluginRegistry ?? new PluginRegistry(options?.plugins);
    this.spanRegistry = options?.spanRegistry ?? new SpanRegistry();
    this.blockRegistry = options?.blockRegistry ?? new BlockRegistry();
    this.idGenerator = options?.idGenerator ?? makeDefaultIdGenerator();
    this.m = new MarkupGenerator(this.idGenerator);

    if (options?.state) {
      this.state = options.state;
    } else {
      const { m } = this;
      this.state = State.fromMarkup(
        m.doc([m.textBlock([m.span("")])]),
        this.blockRegistry,
        this.idGenerator,
      );
    }
  }

  public mount(editor: Editor) {
    this.editor = editor;

    observe(this.state, "cursorState", (s: CursorState | undefined) =>
      this.cursorChanged.emit(s)
    );
  }

  public insertBlockAfterId(element: BlockElement, afterId: string, options?: IInsertOptions): string {
    const editor = this.editor!;

    const prevNode = this.state.idMap.get(afterId)!;
    const parentNode = prevNode.parent! as BlockyElement;

    const updateState = () => {
      parentNode.insertAfter(element, prevNode);
    };
    if (options?.noRender !== true) {
      editor.update(() => {
        updateState();
        if (options?.autoFocus) {
          return () => {
            this.state.cursorState = {
              type: "collapsed",
              targetId: element.id,
              offset: 0,
            };
          };
        }
      });
    } else {
      updateState();
    }

    return element.id;
  }

  emitNextTicks() {
    const fns = this.#nextTick;
    if (fns.length > 0) {
      setTimeout(() => {
        for (const fn of fns) {
          try {
            fn();
          } catch (err) {
            console.error(err);
          }
        }
      }, 0);
    }
    this.#nextTick = [];
  }

  public enqueueNextTick(fn: NextTickFn) {
    this.#nextTick.push(fn);
  }

  public formatText(
    blockId: string,
    index: number,
    length: number,
    attribs?: AttributesObject
  ) {
    if (length === 0) {
      return;
    }

    const blockElement = this.state.idMap.get(blockId) as BlockElement;

    const { editor } = this;
    if (!editor) {
      return;
    }

    // prevent the cursor from jumping around
    editor.state.cursorState = undefined;

    editor.update(() => {
      const blockContent = blockElement.contentContainer;
      if (!blockContent.firstChild) {
        return;
      }
      const textModel = blockContent.firstChild as BlockyTextModel;
      textModel.format(index, length, attribs);

      return () => {
        editor.state.cursorState = {
          type: "open",
          startId: blockId,
          endId: blockId,
          startOffset: index,
          endOffset: index + length,
        };
      };
    });
  }

  public formatTextOnCursor(
    cursorState: CursorState,
    attribs?: AttributesObject
  ) {
    const editor = this.editor;
    if (!editor) {
      return;
    }

    if (cursorState.type === "collapsed") {
      return;
    }

    const { startId, endId, startOffset, endOffset } = cursorState;

    if (startId === endId) {
      // make a single fragment bolded
      const blockNode = editor.state.idMap.get(startId);
      if (!blockNode) {
        console.error(`${startId} not found`);
        return;
      }
      this.formatText(startId, startOffset, endOffset - startOffset, attribs);
    }
  }

  public formatTextOnSelectedText(attribs?: AttributesObject) {
    const editor = this.editor;
    if (!editor) {
      return;
    }
    const { cursorState } = editor.state;
    if (!cursorState) {
      return;
    }
    this.formatTextOnCursor(cursorState, attribs);
  }

  public deleteBlock(id: string) {
    const { editor } = this;
    if (!editor) {
      return;
    }

    this.state.cursorState = undefined;
    editor.update(() => {
      this.state.deleteBlock(id);
    });
  }
}
