import type { IPlugin } from "@pkg/registry/pluginRegistry";
import { SpanType } from "@pkg/registry/spanRegistry";
import { type TreeNode, type DocNode, type Span } from "@pkg/model";
import { Action } from "@pkg/model/actions";
import type { Editor } from "@pkg/view/editor";
import { isHotkey } from "is-hotkey";

const SpanName = "bold";

/**
 * This plugin is used to make the editor support bolded text.
 * 
 * The bolded text will be wrapped in as `<span>` element.
 * So the plugin register the span in the editor's `SpanRegistry`.
 * 
 * After all, this plugin handles the hotkey to make selected text bolded.
 * 
 */
function makeBoldedTextPlugin(): IPlugin {
  const makeSingleFragmentBolded = (
    editor: Editor,
    spanNode: TreeNode<DocNode>,
    startOffset: number,
    endOffset: number
  ) => {
    if (startOffset === endOffset) {
      return;
    }

    const lineNode = spanNode.parent!.parent!;

    const span = spanNode.data as Span;
    const oldContent = span.content;
    const contentBefore = oldContent.slice(0, startOffset);
    const contentAfter = oldContent.slice(endOffset);
    const newContent = oldContent.slice(startOffset, endOffset);
    const spanId = editor.registry.span.getSpanIdByName(SpanName)!;

    const actions: Action[] = [
      {
        type: "update-span",
        targetId: spanNode.data.id,
        value: {
          flags: spanId,
          content: newContent,
        },
      },
    ];

    const { idGenerator } = editor;

    if (contentBefore.length > 0) {
      const newId = idGenerator.mkSpanId();
      const prevId = spanNode.prev;
      actions.push({
        type: "new-span",
        targetId: lineNode.data.id,
        afterId: prevId?.data.id,
        content: {
          id: newId,
          t: "span",
          flags: 0,
          content: contentBefore,
        },
      });
    }

    if (contentAfter.length > 0) {
      const newId = idGenerator.mkSpanId();
      actions.push({
        type: "new-span",
        targetId: lineNode.data.id,
        afterId: spanNode.data.id,
        content: {
          id: newId,
          t: "span",
          flags: 0,
          content: contentAfter,
        },
      });
    }

    editor.applyActions(actions);
    editor.render(() => {
      editor.state.cursorState = {
        type: "collapsed",
        targetId: spanNode.data.id,
        offset: newContent.length,
      };
    });
  };
  const makeBold = (editor: Editor) => {
    const { cursorState } = editor.state;
    if (!cursorState) {
      return;
    }

    if (cursorState.type === "collapsed") {
      return;
    }

    const { idGenerator } = editor;
    const { startId, endId, startOffset, endOffset } = cursorState;

    if (startId === endId) {
      // make a single fragment bolded
      const spanNode = editor.state.idMap.get(startId);
      if (!spanNode) {
        console.error(`${startId} not found`);
        return;
      }
      makeSingleFragmentBolded(editor, spanNode, startOffset, endOffset);
    } else {
      console.log("unimplemented bold");
    }
  };
  return {
    name: "bolded-text",
    onInitialized(editor: Editor) {
      editor.registry.span.register({
        name: SpanName,
        type: SpanType.StyledText,
        classNames: ["mg-editor-bold"],
      });
      editor.keyDown.on((e: KeyboardEvent) => {
        if (isHotkey("mod+b", e)) {
          e.preventDefault();
          makeBold(editor);
          return;
        }
      });
    },
  };
}

export default makeBoldedTextPlugin;
