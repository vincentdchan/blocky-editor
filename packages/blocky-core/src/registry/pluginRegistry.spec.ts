import { describe, expect, it, vi } from "vitest";
import { PluginRegistry, type IPlugin } from "./pluginRegistry";
import { Editor, EditorController } from "..";

describe("PluginRegistry", () => {
  it("should register plugin", () => {
    const plugin: IPlugin = {
      name: "test",
      onInitialized() {},
      onDispose() {},
    };
    const onInitSpy = vi.spyOn(plugin, "onInitialized");
    const disposeSpy = vi.spyOn(plugin, "onDispose");
    const pluginRegistry = new PluginRegistry([plugin]);
    const editorController = new EditorController("user");
    const dom = document.createElement("div");
    const editor = Editor.fromController(dom, editorController);
    pluginRegistry.initAllPlugins(editor);

    expect(onInitSpy).toBeCalledTimes(1);
    expect(disposeSpy).toBeCalledTimes(0);

    pluginRegistry.unload("test");
    expect(disposeSpy).toBeCalledTimes(1);
  });
});
