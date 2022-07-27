import { isUpperCase } from "blocky-common/es/character";
import { Slot } from "blocky-common/es/events";
import { type Padding } from "blocky-common/es/dom";
import Delta from "quill-delta-es";
import {
  CursorState,
  AttributesObject,
  State,
  BlockyElement,
  BlockyTextModel,
  BlockyNode,
  Changeset,
  BlockElement,
  BlockyDocument,
} from "@pkg/model";
import { symSetCursorState, CursorStateUpdateReason } from "@pkg/model/state";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { PluginRegistry, type IPlugin } from "@pkg/registry/pluginRegistry";
import { SpanRegistry } from "@pkg/registry/spanRegistry";
import { HTMLConverter } from "@pkg/helper/htmlConverter";
import { type BannerFactory } from "@pkg/view/bannerDelegate";
import { type ToolbarFactory } from "@pkg/view/toolbarDelegate";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { BlockPasteEvent, TryParsePastedDOMEvent } from "@pkg/block/basic";
import { TextBlockName } from "@pkg/block/textBlock";
import { type CollaborativeCursorOptions } from "./collaborativeCursors";
import { type Editor } from "./editor";
import { isUndefined } from "lodash-es";

export interface IEditorControllerOptions {
  title?: string;
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
  readonly state: State;
  readonly cursorChanged: Slot<CursorChangedEvent> = new Slot();
  readonly beforeApplyCursorChanged: Slot<CursorChangedEvent> = new Slot();

  /**
   * A class to control the behavior in the editor
   */
  constructor(
    readonly userId: string,
    public options?: IEditorControllerOptions
  ) {
    this.pluginRegistry =
      options?.pluginRegistry ?? new PluginRegistry(options?.plugins);
    this.spanRegistry = options?.spanRegistry ?? new SpanRegistry();
    this.blockRegistry = options?.blockRegistry ?? new BlockRegistry();
    this.idGenerator = options?.idGenerator ?? makeDefaultIdGenerator();

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
      this.state = new State(
        userId,
        new BlockyDocument({
          title: options?.title,
        }),
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
    if (id === this.userId) {
      return;
    }

    const { options } = collaborativeCursorManager;

    const name = options.idToName(id);
    const color = options.idToColor(id);

    editor.drawCollaborativeCursor(id, name, color, evt.state);
  }

  mount(editor: Editor) {
    this.editor = editor;

    this.state.cursorStateChanged.on((e) => {
      const id = this.userId;
      const evt = new CursorChangedEvent(id, e.state);
      this.cursorChanged.emit(evt);
    });
  }

  insertBlockAfterId(
    element: BlockElement,
    afterId: string,
    options?: IInsertOptions
  ): string {
    const editor = this.editor!;

    const prevNode = this.state.getBlockElementById(afterId)!;
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
        changeset.setCursorState(CursorState.collapse(element.id, 0));
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

    const blockElement = this.state.getBlockElementById(
      blockId
    ) as BlockElement;

    const { editor } = this;
    if (!editor) {
      return;
    }

    // prevent the cursor from jumping around

    if (!blockElement.firstChild) {
      return;
    }
    new Changeset(this.state)
      .textEdit(blockElement, "textContent", () =>
        new Delta().retain(index).retain(length, attribs)
      )
      .setCursorState(new CursorState(blockId, index, blockId, index + length))
      .apply();
  }

  formatTextOnCursor(cursorState: CursorState, attribs?: AttributesObject) {
    const editor = this.editor;
    if (!editor) {
      return;
    }

    if (cursorState.isCollapsed) {
      return;
    }

    const { startId, endId, startOffset, endOffset } = cursorState;

    if (startId === endId) {
      // make a single fragment bolded
      const blockNode = editor.state.getBlockElementById(startId);
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

    const blockNode = this.state.getBlockElementById(id);
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

  #deleteContentInsideInSelection(
    cursorState: CursorState
  ): CursorState | null {
    if (cursorState.startId === cursorState.endId) {
      const currentBlockElement = this.state.getBlockElementById(
        cursorState.id
      ) as BlockElement;
      if (currentBlockElement.nodeName === TextBlockName) {
        const startOffset = cursorState.startOffset;
        const newState = CursorState.collapse(cursorState.id, startOffset);
        new Changeset(this.state)
          .textEdit(currentBlockElement, "textContent", () =>
            new Delta()
              .retain(cursorState.startOffset)
              .delete(cursorState.endOffset - cursorState.startOffset)
          )
          .setCursorState(newState)
          .apply();
        return newState;
      } else {
        const next = currentBlockElement.nextSibling as BlockElement | null;
        const changeset = new Changeset(this.state).removeChild(
          currentBlockElement.parent!,
          currentBlockElement
        );
        if (next) {
          const newState = CursorState.collapse(next.id, 0);
          changeset.setCursorState(newState);
          changeset.apply();
          return newState;
        } else {
          changeset.apply();
        }
      }
    }
    return null;
  }

  #pasteElementsAtCursor(elements: BlockElement[]) {
    if (elements.length === 0) {
      return;
    }
    let cursorState = this.state.cursorState;
    if (!cursorState) {
      // if the document is empty,
      // insert to the document directly
      if (!this.state.document.body.firstChild) {
        new Changeset(this.state)
          .insertChildrenAt(this.state.document.body, 0, elements)
          .apply();
      }
      return;
    }
    if (cursorState.isOpen) {
      cursorState = this.#deleteContentInsideInSelection(cursorState);
      if (!cursorState) {
        return;
      }
    }
    const currentBlockElement = this.state.getBlockElementById(
      cursorState.id
    ) as BlockElement;

    // optimize, do NOT do int next tick
    this.enqueueNextTick(() => {
      const parent = currentBlockElement.parent! as BlockyElement;
      const prev = currentBlockElement;

      let appendDelta: Delta | undefined;
      const changeset = new Changeset(this.state);
      const insertChildren: BlockyNode[] = [];
      for (let i = 0, len = elements.length; i < len; i++) {
        const element = elements[i];

        // first item, try to merge text
        if (
          i === 0 &&
          currentBlockElement.nodeName === TextBlockName &&
          element.nodeName === TextBlockName
        ) {
          const prevTextModel = currentBlockElement.getAttribute(
            "textContent"
          ) as BlockyTextModel;
          const firstTextModel = element.getAttribute(
            "textContent"
          ) as BlockyTextModel;
          if (!prevTextModel || !firstTextModel) {
            continue;
          }
          const offset = this.state.cursorState?.offset ?? prevTextModel.length;
          // only insert text, don NOT need to insert
          if (len === 1) {
            changeset.textEdit(currentBlockElement, "textContent", () =>
              new Delta().retain(offset).concat(firstTextModel.delta)
            );
            changeset.setCursorState(
              CursorState.collapse(
                currentBlockElement.id,
                offset + firstTextModel.delta.length()
              )
            );
            break;
          }
          appendDelta = prevTextModel.delta.slice(offset);
          changeset.textEdit(currentBlockElement, "textContent", () =>
            new Delta()
              .retain(offset)
              .delete(prevTextModel.length - offset)
              .concat(firstTextModel.delta)
          );
          continue;
        }
        insertChildren.push(element);
      }
      if (!isUndefined(appendDelta)) {
        if (
          insertChildren.length > 0 &&
          insertChildren[insertChildren.length - 1].nodeName === TextBlockName
        ) {
          // append to previous element
          const lastChild = insertChildren[
            insertChildren.length - 1
          ] as BlockElement;
          const textModel = lastChild.getAttribute(
            "textContent"
          ) as BlockyTextModel;
          const prevOffset = textModel.delta.length();
          changeset.setCursorState(
            CursorState.collapse(lastChild.id, prevOffset)
          );
          const childrenOfChildren: BlockyNode[] = [];
          let ptr = lastChild.firstChild;
          while (ptr) {
            childrenOfChildren.push(ptr);
            ptr = ptr.nextSibling;
          }
          const newChild = new BlockElement(
            TextBlockName,
            lastChild.id,
            {
              ...lastChild.getAttributes(),
              textContent: new BlockyTextModel(
                textModel.delta.concat(appendDelta)
              ),
            },
            childrenOfChildren
          );
          insertChildren[insertChildren.length - 1] = newChild;
        } else {
          const appendElement = this.state.createTextElement(appendDelta);
          const textModel = appendElement.getAttribute(
            "textContent"
          ) as BlockyTextModel;
          changeset.setCursorState(
            CursorState.collapse(appendElement.id, textModel.length)
          );
          insertChildren.push(appendElement);
        }
      }
      changeset.insertChildrenAfter(parent, insertChildren, prev);
      changeset.apply();
    });
    this.emitNextTicks();
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

  setCursorState(cursorState: CursorState | null) {
    this.state[symSetCursorState](
      cursorState,
      CursorStateUpdateReason.setByUser
    );
  }
}
