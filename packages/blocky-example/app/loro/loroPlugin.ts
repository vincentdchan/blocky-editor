import {
  type IPlugin,
  PluginContext,
  DataBaseElement,
  BlockyTextModel,
  DataElement,
  BlockyDocument,
  BlockDataElement,
} from "blocky-core";
import { Loro, LoroMap, LoroText } from "loro-crdt";
import { take, takeUntil } from "rxjs";

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

// FIXME: import from blocky-common
export function isUpperCase(char: string): boolean {
  const codeA = 65;
  const codeZ = 90;
  if (char.length === 0) {
    return false;
  }
  const code = char.charCodeAt(0);
  return code >= codeA && code <= codeZ;
}

function blockyElementFromLoroMap(loroMap: LoroMap): DataElement {
  const t = loroMap.get("t") as string;
  let result: DataElement;
  if (isUpperCase(t[0])) {
    let id = loroMap.get("id") as string;
    if (t === "Title") {
      id = "title";
    }
    result = new BlockDataElement(t, id);
  } else {
    result = new DataElement(t);
  }

  for (const [key, value] of loroMap.entries()) {
    if (key === "id" || key === "t" || key === "children") {
      continue;
    }
    console.log("key:", key, "value:", value, typeof value);
    if (value instanceof LoroText) {
      const text = new BlockyTextModel(value.toDelta() as any);
      result.__setAttribute(key, text);
    } else if (value instanceof LoroMap) {
      result.__setAttribute(key, blockyElementFromLoroMap(value));
    } else {
      result.__setAttribute(key, value);
    }
  }

  return result;
}

function documentFromLoroMap(loroMap: LoroMap): BlockyDocument {
  const title = loroMap.get("title") as LoroMap | undefined;
  const body = loroMap.get("body") as LoroMap;
  const doc = new BlockyDocument();
  if (title) {
    doc.__setAttribute("title", blockyElementFromLoroMap(title));
  }
  doc.__setAttribute("body", blockyElementFromLoroMap(body));

  console.log("doc:", doc);

  return doc;
}

class LoroPlugin implements IPlugin {
  name = "loro";
  loro: Loro<Record<string, undefined>>;
  needsInit = true;

  constructor(loro?: Loro) {
    if (loro) {
      this.needsInit = false;
    }
    this.loro = loro ?? new Loro();
  }

  getInitDocumentByLoro() {
    const loro = this.loro;
    const loroMap = loro.getMap("document");

    return documentFromLoroMap(loroMap);
  }

  onInitialized(context: PluginContext) {
    const loro = this.loro;
    const state = context.editor.state;

    const documentMap = loro.getMap("document");

    if (this.needsInit) {
      syncDocumentToLoro(context, state.document, documentMap);
      loro.commit();
    }

    state.changesetApplied2$.pipe(takeUntil(context.dispose$)).subscribe(() => {
      loro.commit();
    });

    const sub = loro.subscribe((evt) => {
      console.log("loro evt:", evt, "version:", loro.frontiers());
    });
    context.dispose$.pipe(take(1)).subscribe(() => {
      loro.unsubscribe(sub);
    });
  }
}

export default LoroPlugin;
