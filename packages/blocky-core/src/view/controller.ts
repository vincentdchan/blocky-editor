import { isUpperCase } from "blocky-common/es/character";
import { Slot } from "blocky-common/es/events";
import { observe } from "blocky-common/es/observable";
import { type Padding } from "blocky-common/es/dom";
import Delta from "quill-delta-es";
import {
  type CursorState,
  AttributesObject,
  State,
  BlockyElement,
  BlockyTextModel,
  BlockyNode,
  Changeset,
} from "@pkg/model";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { PluginRegistry, type IPlugin } from "@pkg/registry/pluginRegistry";
import { SpanRegistry } from "@pkg/registry/spanRegistry";
import { MarkupGenerator } from "@pkg/model/markup";
import { HTMLConverter } from "@pkg/helper/htmlConverter";
import { type BannerFactory } from "@pkg/view/bannerDelegate";
import { type ToolbarFactory } from "@pkg/view/toolbarDelegate";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import {
  type BlockElement,
  BlockPasteEvent,
  TryParsePastedDOMEvent,
} from "@pkg/block/basic";
import { TextBlockName } from "@pkg/block/textBlock";
import { type CollaborativeCursorOptions } from "./collaborativeCursors";
import { type Editor } from "./editor";

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
  constructor(readonly id: string, readonly state: CursorState | null) {}
}

/**
 * The [EditorController] is focused on the data manipulation.
 * It doesn't cared about the changes on UI.
 *
 * The UI details are handled in [Editor] class.
 * If you want to modify the state easily, use the [EditorController].
 *
 * Another use of [EditorController] is to manipulate the document
 * before the Editor is created.
 * For example, insert text to the document before
 * the editor is created.
 */
export class EditorController {
  #nextTick: NextTickFn[] = [];
  #htmlConverter: HTMLConverter;

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

    this.#htmlConverter = new HTMLConverter({
      idGenerator: this.idGenerator,
      leafHandler: this.#leafHandler,
      divHandler: this.#divHandler,
    });

    options?.plugins?.forEach((plugin) => {
      plugin.blocks?.forEach((block) => {
        this.blockRegistry.register(block);
      });
      plugin.spans?.forEach((span) => {
        this.spanRegistry.register(span);
      });
    });
    this.blockRegistry.seal();
    this.spanRegistry.seal();

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

    observe(this.state, "cursorState", (s: CursorState | null) => {
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

    const updateState = (): Changeset => {
      return new Changeset(editor.state).insertChildrenAfter(
        parentNode,
        [element],
        prevNode
      );
    };
    if (options?.noRender !== true) {
      const changeset = updateState();
      if (options?.autoFocus) {
        changeset.setCursorState({
          type: "collapsed",
          targetId: element.id,
          offset: 0,
        });
      }
      changeset.apply();
    } else {
      updateState().apply();
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

    if (!blockElement.firstChild) {
      return;
    }
    const textModel = blockElement.firstChild as BlockyTextModel;
    new Changeset(this.state)
      .textEdit(textModel, () =>
        new Delta().retain(index).retain(length, attribs)
      )
      .setCursorState({
        type: "open",
        startId: blockId,
        endId: blockId,
        startOffset: index,
        endOffset: index + length,
      })
      .apply();
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

    const blockNode = this.state.idMap.get(id);
    if (!blockNode) {
      return;
    }

    if (!isUpperCase(blockNode.nodeName)) {
      return;
    }

    const parent = blockNode.parent! as BlockyElement;
    new Changeset(this.state).removeChild(parent, blockNode).apply({
      refreshCursor: true,
    });
  }

  /**
   * Use the API provided by the browser to parse the html for the bundle size.
   * Maybe use an external library is better for unit tests. But it will increase
   * the size of the bundles.
   */
  pasteHTMLAtCursor(html: string) {
    try {
      const blocks = this.#htmlConverter.parseFromString(html);
      this.#pasteElementsAtCursor(blocks);
    } catch (e) {
      console.error(e);
    }
  }

  #pasteElementsAtCursor(elements: BlockElement[]) {
    if (elements.length === 0) {
      return;
    }
    const currentBlockElement = this.#getBlockElementAtCollapsedCursor();
    if (!currentBlockElement) {
      return;
    }
    const parent = currentBlockElement.parent! as BlockyElement;
    const prev = currentBlockElement;

    const changeset = new Changeset(this.state);
    const insertChildren: BlockyNode[] = [];
    for (let i = 0, len = elements.length; i < len; i++) {
      const element = elements[i];

      if (
        i === 0 &&
        currentBlockElement.nodeName === TextBlockName &&
        element.nodeName === TextBlockName
      ) {
        const prevTextModel =
          currentBlockElement.firstChild! as BlockyTextModel;
        const firstTextModel = element.firstChild! as BlockyTextModel;
        if (!prevTextModel || !firstTextModel) {
          continue;
        }
        changeset.textConcat(prevTextModel, () => firstTextModel.delta);
        // first item, try to merge text
        continue;
      }
      insertChildren.push(element);
    }
    changeset.insertChildrenAfter(parent, insertChildren, prev);
    changeset.apply();
  }

  #leafHandler = (node: Node): BlockElement | void => {
    const tryEvt = new TryParsePastedDOMEvent({
      editorController: this,
      node: node as HTMLElement,
    });
    const testElement = this.blockRegistry.handlePasteElement(tryEvt);
    if (testElement) {
      return testElement;
    }

    const blockDef = this.blockRegistry.getBlockDefByName(TextBlockName);
    const pasteHandler = blockDef?.onPaste;
    const evt = new BlockPasteEvent({
      node: node as HTMLElement,
      editorController: this,
      converter: this.#htmlConverter,
    });
    if (pasteHandler) {
      return pasteHandler.call(blockDef, evt);
    }
  };

  #divHandler = (node: Node): BlockElement | void => {
    const element = node as HTMLElement;
    const dataType = element.getAttribute("data-type");
    if (!dataType) {
      return;
    }
    const blockDef = this.blockRegistry.getBlockDefByName(dataType);
    if (!blockDef) {
      return;
    }

    const pasteHandler = blockDef?.onPaste;
    if (pasteHandler) {
      const evt = new BlockPasteEvent({
        editorController: this,
        node: element,
        converter: this.#htmlConverter,
      });
      return pasteHandler.call(blockDef, evt);
    }
  };

  /**
   * Calculate the attributes from the dom.
   * It's used for pasting text, and to recognize the dom created by the browser.
   */
  getAttributesBySpan(span: HTMLElement): AttributesObject {
    const spanRegistry = this.spanRegistry;
    const attributes: AttributesObject = {};
    const href = span.getAttribute("data-href");
    if (href) {
      attributes["href"] = href;
    } else if (span instanceof HTMLAnchorElement) {
      attributes["href"] = span.getAttribute("href");
    }

    for (const cls of span.classList) {
      const style = spanRegistry.classnames.get(cls);
      if (style) {
        attributes[style.name] = true;
      }
    }

    return attributes;
  }

  #getBlockElementAtCollapsedCursor(): BlockElement | undefined {
    const { cursorState } = this.state;
    if (!cursorState) {
      return;
    }
    if (cursorState.type === "open") {
      return;
    }

    const { targetId } = cursorState;

    return this.state.idMap.get(targetId) as BlockElement | undefined;
  }
}
