import type { Editor } from "@pkg/view/editor";
import { Action } from "@pkg/model/actions";

export type AfterFn = () => void;

const hookOnInitialized = "onInitialized";
const hookBeforeApply = "beforeApply";

const allowHookName: string[] = [
  hookOnInitialized,
  hookBeforeApply,
];

interface HookMethods {
  [index: string]: IPlugin[],
}

export interface IPlugin {
  name: string,

  /**
   * Will be triggered when the editor is initialized.
   */
  onInitialized?: (editor: Editor) => void;

  beforeApply?: (editor: Editor, actions: Action[]) => (AfterFn | void),
}

export class PluginRegistry {

  #hook: HookMethods = Object.create(null);
  #markedPlugin: Set<string> = new Set();

  constructor(plugins?: IPlugin[]) {
    for (const name of allowHookName) {
      this.#hook[name] = [];
    }

    if (plugins) {
      plugins.forEach(plugin => this.register(plugin));
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
      if (typeof plugin[name] === "function") {
        this.#hook[name].push(plugin);
      }
    }
  }
  
  private genEmit = (hookName: string) => (((...args: any[]) => {
    const plugins = this.#hook[hookName]!;
    for (const plugin of plugins) {
      try {
        // @ts-ignore
        plugin[hookName]!(...args);
      } catch (e) {
        console.error(e);
      }
    }
  }) as any)

  emitInitPlugins: (editor: Editor) => void = this.genEmit(hookOnInitialized);

  emitBeforeApply(editor: Editor, actions: Action[]): AfterFn | undefined {
    const beforeApplyPlugins = this.#hook[hookBeforeApply]!;
    const afterArray: AfterFn[] = []
    for (const plugin of beforeApplyPlugins) {
      const fn = plugin.beforeApply!(editor, actions);
      if (fn) {
        afterArray.push(fn);
      }
    }
    if (afterArray.length === 0) {
      return;
    }
    return () => {
      for (const fn of afterArray) {
        fn();
      }
    }
  }

}
