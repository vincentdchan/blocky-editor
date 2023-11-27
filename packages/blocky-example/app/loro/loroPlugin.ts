import {
  type IPlugin,
  PluginContext,
  DataBaseElement,
  BlockyTextModel,
  DataElement,
  BlockyDocument,
  BlockDataElement,
} from "blocky-core";
import { Loro, LoroMap, LoroText, LoroList, Frontiers } from "loro-crdt";
import { Delta } from "blocky-core";
import { takeUntil, filter } from "rxjs";
import { isHotkey } from "is-hotkey";

function isPrimitive(value: any) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

class LoroBinding {
  constructor(public loro: Loro) {}
  syncDocumentToLoro(doc: DataBaseElement, loroMap: LoroMap) {
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
        this.syncDocumentToLoro(value, childLoroMap);
      } else if (value instanceof BlockyTextModel) {
        const loroText = loroMap.setContainer(key, "Text");
        loroText.applyDelta(value.delta.ops);

        this.bindTextModelToLoroText(value, loroText);
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
      this.syncDocumentToLoro(ptr as DataBaseElement, subDoc);

      ptr = ptr.nextSibling;
      counter++;
    }

    this.bindDataElementToLoroMap(doc, loroMap);
  }
  bindTextModelToLoroText(textModel: BlockyTextModel, loroText: LoroText) {
    textModel.changed$.subscribe((evt) => {
      loroText.applyDelta(evt.apply.ops);
    });
    loroText.subscribe(this.loro, (evt) => {
      if (evt.local && evt.fromCheckout) {
        return;
      }
      if (evt.diff.type === "text") {
      }
    });
  }
  bindDataElementToLoroMap(doc: DataElement, loroMap: LoroMap) {
    const children = loroMap.get("children") as LoroList;
    doc.changed.subscribe((evt) => {
      switch (evt.type) {
        case "element-insert-child": {
          const loroChild = children.insertContainer(evt.index, "Map");
          this.syncDocumentToLoro(evt.child as DataBaseElement, loroChild);
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
    loroMap.subscribe(this.loro, (evt) => {
      if (evt.local) {
        return;
      }
      console.log("loro map event", evt);
    });
  }
  blockyElementFromLoroMap(loroMap: LoroMap): DataElement {
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
        this.bindTextModelToLoroText(text, value);
      } else if (value instanceof LoroMap) {
        result.__setAttribute(key, this.blockyElementFromLoroMap(value));
      } else {
        result.__setAttribute(key, value);
      }
    }

    const children = loroMap.get("children") as LoroList | undefined;
    if (children) {
      for (let i = 0, len = children.length; i < len; i++) {
        const child = children.get(i);
        if (child instanceof LoroMap) {
          result.appendChild(this.blockyElementFromLoroMap(child));
        }
      }
    }

    this.bindDataElementToLoroMap(result, loroMap);

    return result;
  }
  documentFromLoroMap(loroMap: LoroMap): BlockyDocument {
    const title = loroMap.get("title") as LoroMap | undefined;
    const body = loroMap.get("body") as LoroMap;
    const doc = new BlockyDocument({
      title: title
        ? (this.blockyElementFromLoroMap(title) as BlockDataElement)
        : undefined,
      body: this.blockyElementFromLoroMap(body),
    });

    return doc;
  }
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

class LoroPlugin implements IPlugin {
  name = "loro";
  loro: Loro<Record<string, undefined>>;
  needsInit = true;
  undoStack: Frontiers[] = [];
  redoStack: Frontiers[] = [];

  constructor(loro?: Loro) {
    if (loro) {
      this.needsInit = false;
    }
    this.loro = loro ?? new Loro();
  }

  static getInitDocumentByLoro(loro: Loro) {
    const loroMap = loro.getMap("document");

    return new LoroBinding(loro).documentFromLoroMap(loroMap);
  }

  onInitialized(context: PluginContext) {
    const { editor } = context;
    editor.controller.pluginRegistry.unload("undo"); // unload the default undo plugin
    const loro = this.loro;
    const state = context.editor.state;

    const documentMap = loro.getMap("document");

    if (this.needsInit) {
      new LoroBinding(loro).syncDocumentToLoro(state.document, documentMap);
      loro.commit();
    }

    state.changesetApplied2$.pipe(takeUntil(context.dispose$)).subscribe(() => {
      loro.commit();
    });

    editor.keyDown$
      .pipe(
        takeUntil(context.dispose$),
        filter((e) => isHotkey("mod+z", e))
      )
      .subscribe((e: KeyboardEvent) => {
        e.preventDefault();
        try {
          this.undo();
        } catch (err) {
          console.error("[Blocky]undo error", err);
          editor.controller.options?.onError?.(err);
        }
      });

    editor.keyDown$
      .pipe(
        takeUntil(context.dispose$),
        filter((e) => isHotkey("mod+shift+z", e))
      )
      .subscribe((e: KeyboardEvent) => {
        e.preventDefault();
        try {
          this.redo(context);
        } catch (err) {
          console.error("[Blocky]redo error", err);
          editor.controller.options?.onError?.(err);
        }
      });

    editor.state.beforeChangesetApply
      .pipe(takeUntil(context.dispose$))
      .subscribe(() => {
        const frontiers = this.loro.frontiers();
        this.undoStack.push(frontiers);
      });

    // const s = loro.subscribe((evt) => {
    //   if (evt.fromCheckout) {
    //     return;
    //   }
    //   if (evt.local) {
    //     this.#debouncedAddUndoStack();
    //   }
    // });

    // context.dispose$.subscribe(() => {
    //   loro.unsubscribe(s);
    // });
  }

  // #debouncedAddUndoStack = debounce(() => {
  //   const frontiers = this.loro.frontiers();
  //   this.undoStack.push(frontiers);
  // }, 500);

  undo() {
    const current = this.loro.frontiers();
    const last = this.undoStack.pop();
    if (last) {
      console.log("undo", current, last);
      this.loro.checkout(last);
      this.redoStack.push(current);
    }
  }

  redo(context: PluginContext) {
    console.log("redo", context);
  }
}

export default LoroPlugin;
