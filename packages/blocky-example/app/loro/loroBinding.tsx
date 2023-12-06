import {
  DataBaseElement,
  BlockyTextModel,
  DataElement,
  BlockyDocument,
  BlockDataElement,
  EditorState,
  Changeset,
} from "blocky-core";
import { Loro, LoroMap, LoroText, LoroList } from "loro-crdt";
import { Delta } from "blocky-core";
import { filter } from "rxjs";
import { isArray, isNumber, omit } from "lodash-es";
import { isPrimitive, isUpperCase } from "./loroPlugin";

export class LoroBinding {
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
    const id = parent.id;
    loroText.subscribe(this.loro, (evt) => {
      if (!(!evt.local || evt.fromCheckout)) {
        return;
      }
      if (!this.editorState) {
        return;
      }
      const diff = evt.diff;
      if (diff.type === "text") {
        const blockElement = this.editorState.getBlockElementById(id)!;
        const changeset = new Changeset(this.editorState).textEdit(
          blockElement,
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
        const insertedIds: string[] = [];
        const idToLoroMap: Map<string, LoroMap> = new Map();
        for (const op of diff.diff) {
          if (isNumber(op.retain)) {
            index += op.retain;
          } else if (isArray(op.insert)) {
            const children: DataElement[] = [];
            for (const val of op.insert) {
              if (val instanceof LoroMap) {
                const blockElement =
                  this.blockyElementFromLoroMapWithoutBinding(
                    val
                  ) as BlockDataElement;
                if (blockElement instanceof BlockDataElement) {
                  const id = blockElement.id;
                  insertedIds.push(id);
                  children.push(blockElement);
                  idToLoroMap.set(id, val);
                }
              }
            }
            try {
              changeset.insertChildrenAt(doc, index, children);
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

        for (const id of insertedIds) {
          const block = this.editorState.getBlockElementById(id);
          if (block) {
            this.bindDataElementToLoroMap(block, idToLoroMap.get(id)!);
          }
        }
      } else if (diff.type === "map") {
        const updated = omit(diff.updated, ["t", "id", "children"]) as any;

        const id = (doc as BlockDataElement).id;

        const changedTuples: { id: string; key: string; val: LoroText }[] = [];
        for (const key of Object.keys(updated)) {
          const value = updated[key];
          if (value instanceof LoroText) {
            const textModel = new BlockyTextModel(new Delta(value.toDelta()));
            updated[key] = textModel;
            changedTuples.push({
              id,
              key,
              val: value,
            });
          }
        }

        new Changeset(this.editorState).updateAttributes(doc, updated).apply({
          source: LoroBinding.source,
        });

        for (const tuple of changedTuples) {
          const doc = this.editorState.getBlockElementById(tuple.id);
          if (!doc) {
            continue;
          }
          const textModel = doc.getAttribute(tuple.key) as BlockyTextModel;
          if (textModel instanceof BlockyTextModel) {
            this.bindTextModelToLoroText(doc, tuple.key, textModel, tuple.val);
          }
        }
      }
    });
  }

  blockyElementFromLoroMapWithoutBinding(loroMap: LoroMap): DataElement {
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
    return result;
  }

  blockyElementFromLoroMap(loroMap: LoroMap): DataElement {
    const result = this.blockyElementFromLoroMapWithoutBinding(loroMap);

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
