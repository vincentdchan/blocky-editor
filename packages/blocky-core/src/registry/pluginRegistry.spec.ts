import { describe, expect, it, vi } from "vitest";
import { PluginRegistry, type IPlugin } from "./pluginRegistry";
import { Editor, EditorController } from "..";

describe("PluginRegistry", () => {
  it("should register plugin", () => {
    const plugin: IPlugin = {
      name: "test",
      onInitialized() {},
      dispose() {},
    };
    const onInitSpy = vi.spyOn(plugin, "onInitialized");
    const disposeSpy = vi.spyOn(plugin, "dispose");
    const pluginRegistry = new PluginRegistry([plugin]);
    const editorController = new EditorController("user", {
      pluginRegistry,
    });
    const dom = document.createElement("div");
    Editor.fromController(dom, editorController);

    expect(onInitSpy).toBeCalledTimes(1);

    pluginRegistry.unload("test");
    expect(disposeSpy).toBeCalledTimes(1);
  });

  it("dispose", () => {
    const plugin1: IPlugin = {
      name: "test-1",
      onInitialized() {},
      dispose() {},
    };
    const plugin2: IPlugin = {
      name: "test-2",
      onInitialized() {},
      dispose() {},
    };
    const dispose1 = vi.spyOn(plugin1, "dispose");
    const dispose2 = vi.spyOn(plugin2, "dispose");
    const pluginRegistry = new PluginRegistry([plugin1, plugin2]);
    const editorController = new EditorController("user", {
      pluginRegistry,
    });
    const dom = document.createElement("div");
    Editor.fromController(dom, editorController);

    pluginRegistry.dispose();

    expect(dispose1).toBeCalledTimes(1);
    expect(dispose2).toBeCalledTimes(1);
  });
});
