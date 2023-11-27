import {
  type IPlugin,
  PluginContext,
  DataBaseElement,
  BlockyTextModel,
  DataElement,
  BlockyDocument,
  BlockDataElement,
} from "blocky-core";
import { Loro, LoroMap, LoroText, LoroList } from "loro-crdt";
import { Delta } from "blocky-core";
import { takeUntil } from "rxjs";

function isPrimitive(value: any) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function syncDocumentToLoro(doc: DataBaseElement, loroMap: LoroMap) {
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
      syncDocumentToLoro(value, childLoroMap);
    } else if (value instanceof BlockyTextModel) {
      const loroText = loroMap.setContainer(key, "Text");
      loroText.applyDelta(value.delta.ops);

      bindTextModelToLoroText(value, loroText);
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

  if (doc instanceof BlockDataElement) {
    loroMap.set("id", doc.id);
  }

  const children = loroMap.setContainer("children", "List");
  let ptr = doc.firstChild;
  let counter = 0;
  while (ptr) {
    const subDoc = children.insertContainer(counter, "Map");
    syncDocumentToLoro(ptr as DataBaseElement, subDoc);

    ptr = ptr.nextSibling;
    counter++;
  }

  bindDataElementToLoroMap(doc, loroMap);
}

function bindTextModelToLoroText(
  textModel: BlockyTextModel,
  loroText: LoroText
) {
  textModel.changed$.subscribe((evt) => {
    loroText.applyDelta(evt.apply.ops);
  });
}

function bindDataElementToLoroMap(doc: DataElement, loroMap: LoroMap) {
  const children = loroMap.get("children") as LoroList;
  doc.changed.subscribe((evt) => {
    switch (evt.type) {
      case "element-insert-child": {
        const loroChild = children.insertContainer(evt.index, "Map");
        syncDocumentToLoro(evt.child as DataBaseElement, loroChild);
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
    if (value instanceof LoroText) {
      const text = new BlockyTextModel(new Delta(value.toDelta()));
      result.__setAttribute(key, text);
      bindTextModelToLoroText(text, value);
    } else if (value instanceof LoroMap) {
      result.__setAttribute(key, blockyElementFromLoroMap(value));
    } else {
      result.__setAttribute(key, value);
    }
  }

  const children = loroMap.get("children") as LoroList | undefined;
  if (children) {
    for (let i = 0, len = children.length; i < len; i++) {
      const child = children.get(i);
      if (child instanceof LoroMap) {
        result.appendChild(blockyElementFromLoroMap(child));
      }
    }
  }

  bindDataElementToLoroMap(result, loroMap);

  return result;
}

function documentFromLoroMap(loroMap: LoroMap): BlockyDocument {
  const title = loroMap.get("title") as LoroMap | undefined;
  const body = loroMap.get("body") as LoroMap;
  const doc = new BlockyDocument({
    title: title
      ? (blockyElementFromLoroMap(title) as BlockDataElement)
      : undefined,
    body: blockyElementFromLoroMap(body),
  });

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

  static getInitDocumentByLoro(loro: Loro) {
    const loroMap = loro.getMap("document");

    return documentFromLoroMap(loroMap);
  }

  onInitialized(context: PluginContext) {
    const loro = this.loro;
    const state = context.editor.state;

    const documentMap = loro.getMap("document");

    if (this.needsInit) {
      syncDocumentToLoro(state.document, documentMap);
      loro.commit();
    }

    state.changesetApplied2$.pipe(takeUntil(context.dispose$)).subscribe(() => {
      loro.commit();
    });

    // const sub = loro.subscribe((evt) => {
    //   console.log("loro evt:", evt, "version:", loro.frontiers());
    // });
    // context.dispose$.pipe(take(1)).subscribe(() => {
    //   loro.unsubscribe(sub);
    // });
  }
}

export default LoroPlugin;
