import {
  type IPlugin,
  PluginContext,
  DataBaseElement,
  BlockyTextModel,
  DataElement,
} from "blocky-core";
import { Loro, LoroMap } from "loro-crdt";
import { takeUntil } from "rxjs";

function isPrimitive(value: any) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function syncDocumentToLoro(
  ctx: PluginContext,
  doc: DataBaseElement,
  loroMap: LoroMap
) {
  const attribs = doc.getAttributes();

  loroMap.set("t", doc.t);

  const entries = Object.entries(attribs);

  for (const [key, value] of entries) {
    if (isPrimitive(value)) {
      loroMap.set(key, value);
    } else if (Array.isArray(value)) {
      const arr = loroMap.setContainer(key, "List");
      for (let i = 0, len = value.length; i < len; i++) {
        arr.insert(i, value[i]);
      }
    } else if (value instanceof DataBaseElement) {
      const childLoroMap = loroMap.setContainer(key, "Map");
      syncDocumentToLoro(ctx, value, childLoroMap);
    } else if (value instanceof BlockyTextModel) {
      const loroText = loroMap.setContainer(key, "Text");
      loroText.applyDelta(value.delta.ops);

      value.changed$.pipe(takeUntil(ctx.dispose$)).subscribe((evt) => {
        // console.log("content:", loroText.toString());
        loroText.applyDelta(evt.apply.ops);
      });
    } else if (typeof value === "object") {
      const childLoroMap = loroMap.setContainer(key, "Map");
      for (const [childKey, childValue] of Object.entries(value)) {
        childLoroMap.set(childKey, childValue);
      }
    }
  }

  if (!(doc instanceof DataElement)) {
    return;
  }
  const children = loroMap.setContainer("children", "List");
  let ptr = doc.firstChild;
  let counter = 0;
  while (ptr) {
    const subDoc = children.insertContainer(counter, "Map");
    syncDocumentToLoro(ctx, ptr as DataBaseElement, subDoc);

    ptr = ptr.nextSibling;
    counter++;
  }

  doc.changed.pipe(takeUntil(ctx.dispose$)).subscribe((evt) => {
    switch (evt.type) {
      case "element-insert-child": {
        const loroChild = children.insertContainer(evt.index, "Map");
        syncDocumentToLoro(ctx, evt.child as DataBaseElement, loroChild);
        break;
      }

      case "element-remove-child": {
        children.delete(evt.index, 1);
        break;
      }

      case "element-set-attrib": {
        if (evt.value === undefined) {
          loroMap.delete(evt.key);
        } else {
          loroMap.set(evt.key, evt.value);
        }
        break;
      }
    }
  });
}

class LoroPlugin implements IPlugin {
  name = "loro";
  loro: Loro<Record<string, undefined>> | undefined;

  onInitialized(context: PluginContext) {
    const loro = new Loro();
    const state = context.editor.state;
    this.loro = loro;

    const documentMap = loro.getMap("document");
    syncDocumentToLoro(context, state.document, documentMap);

    console.log("loro:", loro.toJson());
    console.log("doc:", state.document);
  }
}

export default LoroPlugin;
