import { isUpperCase } from "blocky-common/es/character";
import { Slot } from "blocky-common/es/events";
import { type Padding } from "blocky-common/es/dom";
import { EditorState, NodeTraverser } from "@pkg/model";
import {
  AttributesObject,
  BlockyElement,
  BlockyTextModel,
  BlockyNode,
  BlockElement,
  BlockyDocument,
  CursorState,
  Changeset,
  blockyNodeFromJsonNode,
  CursorStateUpdateReason,
  ChangesetApplyOptions,
  Delta,
} from "blocky-data";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { PluginRegistry, type IPlugin } from "@pkg/registry/pluginRegistry";
import { SpanRegistry } from "@pkg/registry/spanRegistry";
import { EmbedRegistry } from "@pkg/registry/embedRegistry";
import { HTMLConverter } from "@pkg/helper/htmlConverter";
import { type BannerFactory } from "@pkg/view/bannerDelegate";
import { type ToolbarFactory } from "@pkg/view/toolbarDelegate";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { BlockPasteEvent, TryParsePastedDOMEvent } from "@pkg/block/basic";
import { TextBlock } from "@pkg/block/textBlock";
import { type CollaborativeCursorFactory } from "./collaborativeCursors";
import { Editor } from "./editor";
import { type FollowerWidget } from "./followerWidget";
import type { ThemeData } from "@pkg/model/theme";
import { isUndefined } from "lodash-es";

const defaultEmptyContent = "Empty content";

export interface IEditorControllerOptions {
  /**
   * The title is used to create the document
   *
   * If document is passed, this field is ignored.
   */
  title?: string;

  pluginRegistry?: PluginRegistry;

  /**
   * The document to create the state
   *
   * If this is empty, the controller will create a new one.
   */
  document?: BlockyDocument;

  /**
   * The initial version of the state
   *
   * Default: 0
   */
  initVersion?: number;

  /**
   *
   * Specify the plugins.
   * The plugins will be loaded by the editor
   *
   */
  plugins?: IPlugin[];

  spanRegistry?: SpanRegistry;
  blockRegistry?: BlockRegistry;
  embedRegistry?: EmbedRegistry;
  idGenerator?: IdGenerator;
  bannerFactory?: BannerFactory;
  toolbarFactory?: ToolbarFactory;

  /**
   * The inner padding of the editor
   */
  padding?: Partial<Padding>;

  collaborativeCursorFactory?: CollaborativeCursorFactory;

  /**
   * The container can scroll.
   * When the user types, the element will scroll.
   */
  scrollContainer?: HTMLElement | (() => HTMLElement);

  emptyPlaceholder?: string;

  /**
   * If this is set to false, the spellcheck of the browser
   * will be disabled.
   *
   * Default: true
   */
  spellcheck?: boolean;

  /**
   * Define whether the title is editable
   *
   * Default: true
   */
  titleEditable?: boolean;
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
 * The {@link EditorController} is focused on the data manipulation.
 * It doesn't cared about the changes on UI.
 *
 * The UI details are handled in {@link Editor} class.
 * If you want to modify the state easily, use the {@link EditorController}.
 *
 * Another use of {@link EditorController} is to manipulate the document
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
  readonly embedRegistry: EmbedRegistry;
  readonly blockRegistry: BlockRegistry;
  readonly idGenerator: IdGenerator;
  readonly state: EditorState;
  readonly cursorChanged: Slot<CursorChangedEvent> = new Slot();
  readonly beforeApplyCursorChanged: Slot<CursorChangedEvent> = new Slot();
  readonly emptyPlaceholder: string;

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
    this.embedRegistry = options?.embedRegistry ?? new EmbedRegistry();
    this.blockRegistry = options?.blockRegistry ?? new BlockRegistry();
    this.idGenerator = options?.idGenerator ?? makeDefaultIdGenerator();
    this.emptyPlaceholder = options?.emptyPlaceholder ?? defaultEmptyContent;

    this.#htmlConverter = new HTMLConverter({
      idGenerator: this.idGenerator,
      leafHandler: this.#leafHandler,
      divHandler: this.#divHandler,
    });

    options?.plugins?.forEach((plugin) => {
      plugin.blocks?.forEach((block) => this.blockRegistry.register(block));
      plugin.spans?.forEach((span) => this.spanRegistry.register(span));
      plugin.embeds?.forEach((embed) => this.embedRegistry.register(embed));
    });
    this.blockRegistry.seal();
    this.spanRegistry.seal();

    this.state = new EditorState({
      userId,
      document:
        options?.document ??
        new BlockyDocument({
          title: options?.title,
        }),
      initVersion: options?.initVersion,
      blockRegistry: this.blockRegistry,
      idGenerator: this.idGenerator,
    });
  }

  get themeData(): ThemeData | undefined {
    return this.editor?.themeData;
  }

  set themeData(themeData: ThemeData | undefined) {
    if (this.editor) {
      this.editor.themeData = themeData;
    }
  }

  /**
   * Apply cursor changed event from another users.
   * The renderer will draw the collaborative cursor
   * from another user.
   */
  applyCursorChangedEvent(evt: CursorChangedEvent) {
    this.beforeApplyCursorChanged.emit(evt);
    const { editor } = this;
    if (!editor) {
      return;
    }
    const { id } = evt;
    if (id === this.userId) {
      return;
    }

    editor.drawCollaborativeCursor(id, evt.state);
  }

  /**
   * Apply the delta if the cursor is pointing at a
   * TextBlock. This method will auto set the cursor for you.
   */
  applyDeltaAtCursor(
    deltaGen: (offset: number) => Delta,
    options?: Partial<ChangesetApplyOptions>
  ) {
    const element = this.getBlockElementAtCursor();
    if (!element) {
      return;
    }
    if (element.nodeName !== TextBlock.Name) {
      return;
    }
    const offset = this.state.cursorState?.startOffset;
    if (typeof offset === "undefined") {
      return;
    }
    const delta = deltaGen(offset);
    const appliedLen = delta.changeLength() + offset;

    new Changeset(this.state)
      .textEdit(element, "textContent", () => delta)
      .setCursorState(CursorState.collapse(element.id, appliedLen))
      .apply(options);
  }

  mount(editor: Editor) {
    this.editor = editor;

    this.state.cursorStateChanged.on((e) => {
      const id = this.userId;
      const evt = new CursorChangedEvent(id, e.state);
      this.cursorChanged.emit(evt);
    });
  }

  /**
   * Insert a block in a element after id.
   * This method will apply a changeset to the state and
   * trigger the rendering process of the editor.
   */
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

  formatTextOnCursor(cursorState: CursorState, attribs?: AttributesObject) {
    const editor = this.editor;
    if (!editor) {
      return;
    }

    if (cursorState.isCollapsed) {
      return;
    }

    const changeset = new Changeset(this.state);
    const states = this.state.splitCursorStateByBlocks(cursorState);

    for (const state of states) {
      const blockElement = this.state.getBlockElementById(state.endId)!;
      if (blockElement.nodeName !== TextBlock.Name) {
        continue;
      }
      changeset.textEdit(blockElement, "textContent", () =>
        new Delta()
          .retain(state.startOffset)
          .retain(state.endOffset - state.startOffset, attribs)
      );
    }

    changeset.apply({
      refreshCursor: true,
    });
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

  /**
   * Delete the block by id
   */
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

    new Changeset(this.state).removeNode(blockNode).apply({
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

  deleteContentInsideInSelection(cursorState: CursorState): CursorState | null {
    if (cursorState.startId === cursorState.endId) {
      const currentBlockElement = this.state.getBlockElementById(
        cursorState.id
      )!;
      if (this.state.isTextLike(currentBlockElement)) {
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
    } else {
      const startNode = this.state.getBlockElementById(cursorState.startId)!;
      const endNode = this.state.getBlockElementById(cursorState.endId)!;
      const nodeTraverser = new NodeTraverser(this.state, startNode);
      const changeset = new Changeset(this.state);

      while (nodeTraverser.peek()) {
        const item = nodeTraverser.next()!;

        if (startNode === item && this.state.isTextLike(startNode)) {
          const textModel = (item as BlockElement).getTextModel("textContent")!;
          changeset.textEdit(item as BlockElement, "textContent", () =>
            new Delta()
              .retain(cursorState.startOffset)
              .delete(textModel.length - cursorState.startOffset)
          );
          changeset.setCursorState(
            CursorState.collapse(
              (item as BlockElement).id,
              cursorState.startOffset
            )
          );
        } else if (endNode === item && this.state.isTextLike(endNode)) {
          const textModel = (item as BlockElement).getTextModel("textContent")!;
          const tail = textModel.delta.slice(cursorState.endOffset);
          changeset.textEdit(startNode, "textContent", () =>
            new Delta().retain(cursorState.startOffset).concat(tail)
          );
          changeset.removeNode(item);
        } else {
          changeset.removeNode(item);
        }

        if (item === endNode) {
          break;
        }
      }

      changeset.apply();
      return changeset.afterCursor ?? null;
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
      cursorState = this.deleteContentInsideInSelection(cursorState);
      if (!cursorState) {
        return;
      }
    }
    const currentBlockElement = this.state.getBlockElementById(cursorState.id)!;

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
        this.state.isTextLike(currentBlockElement) &&
        this.state.isTextLike(element)
      ) {
        const prevTextModel = currentBlockElement.getTextModel("textContent")!;
        const firstTextModel = element.getTextModel("textContent");
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
        this.state.isTextLike(insertChildren[insertChildren.length - 1])
      ) {
        // append to previous element
        const lastChild = insertChildren[
          insertChildren.length - 1
        ] as BlockElement;
        const textModel = lastChild.getTextModel("textContent")!;
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
          TextBlock.Name,
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
        const textModel = appendElement.getTextModel("textContent")!;
        changeset.setCursorState(
          CursorState.collapse(appendElement.id, textModel.length)
        );
        insertChildren.push(appendElement);
      }
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

    const blockDef = this.blockRegistry.getBlockDefByName(TextBlock.Name);
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

    const jsonData = element.getAttribute("data-content");
    if (jsonData) {
      const data = JSON.parse(jsonData);
      const node = blockyNodeFromJsonNode(data);
      if (node instanceof BlockElement) {
        return node.cloneWithId(this.idGenerator.mkBlockId());
      }
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

  /**
   * Force set the cursor state.
   *
   * Using the changeset is a recommended way to update the cursor.
   */
  setCursorState(cursorState: CursorState | null) {
    this.state.__setCursorState(cursorState, CursorStateUpdateReason.changeset);
  }

  /**
   * Insert the {@link FollowerWidget} at the position of the current cursor.
   */
  insertFollowerWidget(widget: FollowerWidget) {
    this.editor?.insertFollowerWidget(widget);
  }

  getBlockElementAtCursor(): BlockElement | null {
    if (this.state.cursorState === null) {
      return null;
    }
    return this.state.getBlockElementById(this.state.cursorState.id)!;
  }
}
