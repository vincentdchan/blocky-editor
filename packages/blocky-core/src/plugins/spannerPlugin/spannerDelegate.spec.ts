import { describe, expect, it, vi } from "vitest";
import { SpannerDelegate, SpannerInstance } from "./spannerDelegate";
import { EditorController } from "@pkg/view/controller";
import { bky } from "@pkg/helper/bky";
import { Editor } from "@pkg/index";

describe("SpannerDelegate", () => {
  it("focusedNode", () => {
    const editorController = new EditorController("user");

    const spannerInstance: SpannerInstance = {
      onFocusedNodeChanged: () => {},
      dispose() {},
    };

    const mount = document.createElement("div");

    const editor = Editor.fromController(mount, editorController);
    const delegate = new SpannerDelegate(editor, () => {
      return spannerInstance;
    });
    delegate.mount(mount);

    const focusedNode1 = bky.text();
    const focusedNode2 = bky.text();

    const focusedNodeChangedSpy = vi.spyOn(
      spannerInstance,
      "onFocusedNodeChanged"
    );
    const disposeSpy = vi.spyOn(spannerInstance, "dispose");

    delegate.focusedNode = focusedNode1;

    expect(focusedNodeChangedSpy).toHaveBeenCalledTimes(1);

    delegate.focusedNode = focusedNode2;

    expect(focusedNodeChangedSpy).toHaveBeenCalledTimes(2);

    delegate.focusedNode = focusedNode2;
    expect(focusedNodeChangedSpy).toHaveBeenCalledTimes(2); // shoud not increase

    delegate.dispose();
    expect(disposeSpy).toHaveBeenCalledOnce();
  });
});
