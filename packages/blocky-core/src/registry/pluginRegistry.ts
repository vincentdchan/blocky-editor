import { isFunction } from "lodash-es";
import type { IBlockDefinition } from "@pkg/block/basic";
import type { Editor } from "@pkg/view/editor";

export type AfterFn = () => void;

const hookOnInitialized = "onInitialized";
const hookBeforeApply = "beforeApply";

const allowHookName: string[] = [hookOnInitialized, hookBeforeApply];

interface HookMethods {
  [index: string]: IPlugin[];
}

export interface IPlugin {
  name: string;

  /**
   * The block registered by the plugin.
   */
  blocks?: IBlockDefinition[];

  /**
   * Will be triggered when the editor is initialized.
   */
  onInitialized?(editor: Editor): void;
}

export class PluginRegistry {
  #hook: HookMethods = Object.create(null);
  #markedPlugin: Set<string> = new Set();

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
    if (this.#markedPlugin.has(pluginName)) {
      throw new Error(`duplicated plugin: ${pluginName}`);
    }
    this.#markedPlugin.add(pluginName);

    for (const name of allowHookName) {
      // @ts-ignore
      if (isFunction(plugin[name])) {
        this.#hook[name].push(plugin);
      }
    }
  }

  private genEmit = (hookName: string) =>
    ((...args: any[]) => {
      const plugins = this.#hook[hookName]!;
      for (const plugin of plugins) {
        try {
          // @ts-ignore
          plugin[hookName]!(...args);
        } catch (e) {
          console.error(e);
        }
      }
    }) as any;

  emitInitPlugins: (editor: Editor) => void = this.genEmit(hookOnInitialized);
}
