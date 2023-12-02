import { isFunction } from "lodash-es";
import type { IBlockDefinition } from "@pkg/block/basic";
import type { Editor } from "@pkg/view/editor";
import type { SpanStyle } from "./spanRegistry";
import type { EmbedDefinition } from "./embedRegistry";
import { Subject } from "rxjs";

export type AfterFn = () => void;

const hookOnInitialized = "onInitialized";
const hookBeforeApply = "beforeApply";

const allowHookName: string[] = [hookOnInitialized, hookBeforeApply];

interface HookMethods {
  [index: string]: IPlugin[];
}

export interface BlockyPasteEvent {
  ctx: PluginContext;
  raw: ClipboardEvent;
}

export interface IPlugin {
  name: string;

  /**
   * The span registered by the plugin.
   */
  spans?: SpanStyle[];

  /**
   * The embed registered by the plugin.
   */
  embeds?: EmbedDefinition[];

  /**
   * The block registered by the plugin.
   */
  blocks?: IBlockDefinition[];

  /**
   * Will be triggered when the editor is initialized.
   */
  onInitialized?(context: PluginContext): void;

  onDispose?(context: PluginContext): void;

  onPaste?(evt: BlockyPasteEvent): void;
}

export class PluginContext {
  dispose$ = new Subject<void>();
  constructor(public editor: Editor) {}

  dispose() {
    this.dispose$.next();
  }
}

export class PluginRegistry {
  #hook: HookMethods = Object.create(null);
  plugins: Map<string, IPlugin> = new Map();
  private contexts: Map<string, PluginContext> = new Map();

  constructor(plugins?: IPlugin[]) {
    for (const name of allowHookName) {
      this.#hook[name] = [];
    }

    if (plugins) {
      plugins.forEach((plugin) => this.register(plugin));
    }
  }

  register(plugin: IPlugin) {
    const pluginName = plugin.name;
    if (this.plugins.has(pluginName)) {
      throw new Error(`duplicated plugin: ${pluginName}`);
    }
    this.plugins.set(pluginName, plugin);

    for (const name of allowHookName) {
      // @ts-ignore
      if (isFunction(plugin[name])) {
        this.#hook[name].push(plugin);
      }
    }
  }

  unload(name: string) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return;
    }
    this.plugins.delete(name);

    const context = this.contexts.get(name);
    if (context) {
      context.dispose();
      this.contexts.delete(name);
      plugin.onDispose?.(context);
    }
  }

  initAllPlugins(editor: Editor) {
    for (const plugin of this.plugins.values()) {
      const context = new PluginContext(editor);
      this.contexts.set(plugin.name, context);
      plugin.onInitialized?.(context);
    }
  }

  handlePaste(e: ClipboardEvent) {
    for (const plugin of this.plugins.values()) {
      const ctx = this.contexts.get(plugin.name)!;
      plugin.onPaste?.({ ctx, raw: e });
    }
  }
}
