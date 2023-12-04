import { describe, expect, it, vi } from "vitest";
import { PluginRegistry, type IPlugin } from "./pluginRegistry";
import { Editor, EditorController } from "..";

describe("PluginRegistry", () => {
  it("should register plugin", () => {
    const plugin: IPlugin = {
      name: "test",
      onInitialized() {},
    };
    const onInitSpy = vi.spyOn(plugin, "onInitialized");
    const pluginRegistry = new PluginRegistry([plugin]);
    const editorController = new EditorController("user");
    const dom = document.createElement("div");
    const editor = Editor.fromController(dom, editorController);
    pluginRegistry.initAllPlugins(editor);

    expect(onInitSpy).toBeCalledTimes(1);

    pluginRegistry.unload("test");
  });
});
