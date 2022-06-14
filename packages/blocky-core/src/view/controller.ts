import { Slot } from "blocky-common/es/events";
import { observe } from "blocky-common/es/observable";
import { DocNode, State, TreeNode } from "@pkg/model";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { PluginRegistry, type IPlugin } from "@pkg/registry/pluginRegistry";
import { SpanRegistry } from "@pkg/registry/spanRegistry";
import { MarkupGenerator } from "@pkg/model/markup";
import { TextBlockName } from "@pkg/block/textBlock";
import { type BannerDelegateOptions } from "@pkg/view/bannerDelegate";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { type Editor } from "./editor";
import { type CursorState } from "@pkg/model/cursor";

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
  banner?: BannerDelegateOptions;
}

export interface IInsertOptions {
  autoFocus: boolean;
  blockName?: string;
  data?: any;
}

export class EditorController {
  public editor: Editor | undefined;
  public readonly pluginRegistry: PluginRegistry;
  public readonly spanRegistry: SpanRegistry;
  public readonly blockRegistry: BlockRegistry;
  public readonly idGenerator: IdGenerator;
  public readonly m: MarkupGenerator;
  public readonly state: State;
  public readonly cursorChanged: Slot<CursorState | undefined> = new Slot;

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
        m.doc([m.line([m.span("Hello World")])]),
        this.blockRegistry
      );
    }
  }

  mount(editor: Editor) {
    this.editor = editor;

    observe(this.state, "cursorState", (s: CursorState | undefined) => this.cursorChanged.emit(s));
  }

  insertBlockAfterId(afterId: string, options?: IInsertOptions) {
    const { editor } = this;
    if (!editor) {
      return;
    }

    const prevNode = this.state.idMap.get(afterId)!;
    const parentNode = prevNode.parent!;

    const blockName = options?.blockName ?? TextBlockName;

    const newId = editor.idGenerator.mkBlockId();
    editor.applyActions([
      {
        type: "new-block",
        blockName,
        targetId: parentNode.data.id,
        newId,
        afterId,
        data: options?.data,
      },
    ]);
    editor.render(() => {
      if (options?.autoFocus) {
        this.state.cursorState = {
          type: "collapsed",
          targetId: newId,
          offset: 0,
        };
      }
    });
  }

  deleteBlock(id: string) {
    const { editor } = this;
    if (!editor) {
      return;
    }

    this.state.cursorState = undefined;
    editor.applyActions([
      {
        type: "delete",
        targetId: id,
      },
    ]);
    editor.render();
  }

  get bannerFocusedNode(): TreeNode<DocNode> | undefined {
    return this.editor?.bannerDelegate.focusedNode;
  }
}
