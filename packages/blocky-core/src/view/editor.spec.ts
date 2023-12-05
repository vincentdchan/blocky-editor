import { describe, expect, it, vi } from "vitest";
import { Editor } from "./editor";
import { EditorController } from "./controller";
import { PluginRegistry } from "@pkg/registry/pluginRegistry";

describe("Editor", () => {
  it("dispose", () => {
    const pluginRegistry = new PluginRegistry([]);
    const editorController = new EditorController("user", {
      pluginRegistry,
    });
    const dom = document.createElement("div");
    const editor = Editor.fromController(dom, editorController);
    pluginRegistry.initAllPlugins(editor);

    const disposeSpy = vi.spyOn(pluginRegistry, "dispose");

    editor.dispose();

    expect(disposeSpy).toBeCalledTimes(1);
  });
});
