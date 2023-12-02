import {
  type IPlugin,
  PluginContext,
  DataBaseElement,
  BlockyTextModel,
  DataElement,
  BlockyDocument,
  BlockDataElement,
  EditorState,
  Changeset,
  IBlockDefinition,
} from "blocky-core";
import {
  Loro,
  LoroMap,
  LoroText,
  LoroList,
  Frontiers,
  ContainerID,
} from "loro-crdt";
import { Delta } from "blocky-core";
import { takeUntil, filter } from "rxjs";
import { isHotkey } from "is-hotkey";
import { isArray, isNumber } from "lodash-es";
import { DefaultBlockOutline, makeReactBlock } from "blocky-react";
import LoroBlock from "./loroBlock";

function isPrimitive(value: any) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

class LoroBinding {
  static source = "loro";

  editorState: EditorState | null = null;

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
        this.bindTextModelToLoroText(
          doc as BlockDataElement,
          key,
          value,
          loroText
        );
      } else if (typeof value === "object") {
        console.log("object", key, value);
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

  bindTextModelToLoroText(
    parent: BlockDataElement,
    key: string,
    textModel: BlockyTextModel,
    loroText: LoroText
  ) {
    textModel.changed$
      .pipe(filter((evt) => evt.source !== LoroBinding.source))
      .subscribe((evt) => {
        console.log("text model changed", evt);
        loroText.applyDelta(evt.apply.ops);
      });
    loroText.subscribe(this.loro, (evt) => {
      if (!(!evt.local || evt.fromCheckout)) {
        return;
      }
      if (!this.editorState) {
        return;
      }
      const diff = evt.diff;
      if (diff.type === "text") {
        const changeset = new Changeset(this.editorState).textEdit(
          parent,
          key,
          () => new Delta((evt.diff as any).diff)
        );
        console.log("changeset", changeset);
        changeset.apply({
          source: LoroBinding.source,
        });
      }
    });
  }

  bindDataElementToLoroMap(doc: DataElement, loroMap: LoroMap) {
    const children = loroMap.get("children") as LoroList;
    doc.changed
      .pipe(filter((evt) => evt.source !== LoroBinding.source))
      .subscribe((evt) => {
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
      if (evt.local && !evt.fromCheckout) {
        return;
      }
      if (!this.editorState) {
        return;
      }
      const diff = evt.diff;
      if (diff.type === "list") {
        const changeset = new Changeset(this.editorState);
        let index = 0;
        for (const op of diff.diff) {
          if (isNumber(op.retain)) {
            index += op.retain;
          } else if (isArray(op.insert)) {
            try {
              changeset.insertChildrenAt(
                doc,
                index,
                op.insert.map((v) => {
                  const container = this.loro.getContainerById(
                    v as any as ContainerID
                  ) as LoroMap;
                  return this.blockyElementFromLoroMap(container);
                })
              );
            } catch (err) {
              console.error("insertChildrenAt error", err, op.insert);
              throw err;
            }

            index += op.insert.length;
          } else if (isNumber(op.delete)) {
            changeset.deleteChildrenAt(doc, index, op.delete);
          }
        }
        changeset.apply({
          source: LoroBinding.source,
        });
      } else if (diff.type === "map") {
        new Changeset(this.editorState)
          .updateAttributes(doc, diff.updated)
          .apply({
            source: LoroBinding.source,
          });
      }
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
        this.bindTextModelToLoroText(
          result as BlockDataElement,
          key,
          text,
          value
        );
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
  binding: LoroBinding;
  blocks: IBlockDefinition[];

  constructor(loro?: Loro) {
    if (loro) {
      this.needsInit = false;
    }
    this.loro = loro ?? new Loro();
    this.binding = new LoroBinding(this.loro);
    this.blocks = [
      makeReactBlock({
        name: "Loro",
        component: () => (
          <DefaultBlockOutline>
            <LoroBlock plugin={this} />
          </DefaultBlockOutline>
        ),
      }),
    ];
  }

  getInitDocumentByLoro() {
    if (this.needsInit) {
      return undefined;
    }
    const loroMap = this.loro.getMap("document");

    return this.binding.documentFromLoroMap(loroMap);
  }

  onInitialized(context: PluginContext) {
    const { editor } = context;
    this.binding.editorState = editor.state;
    editor.controller.pluginRegistry.unload("undo"); // unload the default undo plugin
    const loro = this.loro;
    const state = context.editor.state;

    const documentMap = loro.getMap("document");

    if (this.needsInit) {
      new LoroBinding(loro).syncDocumentToLoro(state.document, documentMap);
      loro.commit();
    }

    state.changesetApplied2$
      .pipe(
        takeUntil(context.dispose$),
        filter((evt) => evt.options.source !== LoroBinding.source)
      )
      .subscribe(() => {
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
      .pipe(
        takeUntil(context.dispose$),
        filter((evt) => evt.options.source !== LoroBinding.source)
      )
      .subscribe(() => {
        const frontiers = this.loro.frontiers();
        this.undoStack.push(frontiers);
      });
  }

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
