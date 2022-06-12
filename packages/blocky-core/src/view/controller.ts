import { State } from "@pkg/model";
import { BlockRegistry } from "@pkg/registry/blockRegistry";
import { PluginRegistry, type IPlugin } from "@pkg/registry/pluginRegistry";
import { SpanRegistry } from "@pkg/registry/spanRegistry";
import { type IdGenerator, makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { type Editor } from "./editor";
import { MarkupGenerator } from "@pkg/model/markup";

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
  state?: State,
  idGenerator?: IdGenerator
}


export class EditorController {
  public editor: Editor | undefined;
  public pluginRegistry: PluginRegistry;
  public spanRegistry: SpanRegistry;
  public blockRegistry: BlockRegistry;
  public idGenerator: IdGenerator;
  public m: MarkupGenerator;
  public state: State;

  /**
   * A class to control the behavior in the editor
   */
  constructor(options?: IEditorControllerOptions) {
    this.pluginRegistry = options?.pluginRegistry ?? new PluginRegistry(options?.plugins);
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
      );
    }
  }

  mount(editor: Editor) {
    this.editor = editor;
  }

}
