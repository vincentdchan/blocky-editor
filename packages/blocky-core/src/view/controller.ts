import { Slot } from "blocky-common/es/events";
import { observe } from "blocky-common/es/observable";
import { type Padding } from "blocky-common/es/dom";
import Delta from "quill-delta-es";
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
import { type BlockElement } from "@pkg/block/basic";
import { type CollaborativeCursorOptions } from "./collaborativeCursors";
import { type Editor } from "./editor";
import { isUpperCase } from "blocky-common/es/character";

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

  collaborativeCursorOptions?: CollaborativeCursorOptions;
}

export interface IInsertOptions {
  autoFocus?: boolean;
  noRender?: boolean;
}

export type NextTickFn = () => void;

export class CursorChangedEvent {
  constructor(readonly id: string, readonly state: CursorState | undefined) {}
}

export class EditorController {
  #nextTick: NextTickFn[] = [];

  editor: Editor | undefined;
  readonly pluginRegistry: PluginRegistry;
  readonly spanRegistry: SpanRegistry;
  readonly blockRegistry: BlockRegistry;
  readonly idGenerator: IdGenerator;
  readonly m: MarkupGenerator;
  readonly state: State;
  readonly cursorChanged: Slot<CursorChangedEvent> = new Slot();
  readonly beforeApplyCursorChanged: Slot<CursorChangedEvent> = new Slot();

  static emptyState(options?: IEditorControllerOptions): EditorController {
    const blockRegistry = options?.blockRegistry ?? new BlockRegistry();
    const idGenerator = options?.idGenerator ?? makeDefaultIdGenerator();
    const m = new MarkupGenerator(idGenerator);

    const state = State.fromMarkup(m.doc([]), blockRegistry, idGenerator);

    return new EditorController({
      ...options,
      blockRegistry,
      idGenerator,
      state,
    });
  }

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
        m.doc([m.textBlock("")]),
        this.blockRegistry,
        this.idGenerator
      );
    }
  }

  applyCursorChangedEvent(evt: CursorChangedEvent) {
    this.beforeApplyCursorChanged.emit(evt);
    const { editor } = this;
    if (!editor) {
      return;
    }
    const { collaborativeCursorManager } = editor;
    const { id } = evt;
    if (id === collaborativeCursorManager.options.id) {
      return;
    }

    const { options } = collaborativeCursorManager;

    const name = options.idToName(id);
    const color = options.idToColor(id);

    editor.drawCollaborativeCursor(id, name, color, evt.state);
  }

  mount(editor: Editor) {
    this.editor = editor;

    observe(this.state, "cursorState", (s: CursorState | undefined) => {
      const id = editor.collaborativeCursorManager.options.id;
      const evt = new CursorChangedEvent(id, s);
      this.cursorChanged.emit(evt);
    });
  }

  insertBlockAfterId(
    element: BlockElement,
    afterId: string,
    options?: IInsertOptions
  ): string {
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

  enqueueNextTick(fn: NextTickFn) {
    this.#nextTick.push(fn);
  }

  formatText(
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
      if (!blockElement.firstChild) {
        return;
      }
      const textModel = blockElement.firstChild as BlockyTextModel;
      textModel.compose(new Delta().retain(index).retain(length, attribs));

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

  formatTextOnCursor(cursorState: CursorState, attribs?: AttributesObject) {
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

  formatTextOnSelectedText(attribs?: AttributesObject) {
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

  deleteBlock(id: string) {
    const { editor } = this;
    if (!editor) {
      return;
    }

    this.state.cursorState = undefined;
    const blockNode = this.state.idMap.get(id);
    if (!blockNode) {
      return;
    }

    if (!isUpperCase(blockNode.nodeName)) {
      return;
    }

    editor.update(() => {
      const parent = blockNode.parent! as BlockyElement;
      parent.removeChild(blockNode);
    });
  }
}
