import * as Y from "yjs";
import {
  type IPlugin,
  type Editor,
  BlockyElement,
  type ElementChangedEvent,
  BlockyTextModel,
  type DocumentState,
  type BlockyNode,
  BlockElement,
  Changeset,
} from "blocky-core";
import Delta from "quill-delta-es";
import { isUpperCase } from "blocky-common/es/character";

export interface IYjsPluginOptions {
  doc: Y.Doc;
  allowInit?: boolean;
}

function createXmlTextByBlockyText(
  editor: Editor,
  textModel: BlockyTextModel
): Y.XmlText {
  const result = new Y.XmlText();

  result.applyDelta(textModel.delta.ops);

  bindTextModel(editor, textModel, result);

  return result;
}

function withSilent(state: DocumentState, fn: () => void) {
  if (state.silent) {
    return;
  }
  state.silent = true;
  try {
    fn();
  } finally {
    state.silent = false;
  }
}

function bindTextModel(
  editor: Editor,
  textModel: BlockyTextModel,
  yTextModel: Y.XmlText
) {
  const { state } = editor;
  yTextModel.observe((e: Y.YTextEvent) => {
    withSilent(state, () => {
      new Changeset(state)
        .textEdit(textModel, () => new Delta(e.delta as any))
        .apply();
    });
  });

  textModel.changed.on(({ oldDelta, newDelta }) => {
    const diff = oldDelta.diff(newDelta);
    withSilent(state, () => {
      yTextModel.applyDelta(diff.ops);
    });
  });
}

function createBlockyTextModelByYText(
  editor: Editor,
  yText: Y.XmlText
): BlockyTextModel {
  const delta = yText.toDelta();

  const result = new BlockyTextModel(new Delta(delta));

  bindTextModel(editor, result, yText);

  return result;
}

export function makeYjsPlugin(options: IYjsPluginOptions): IPlugin {
  const { doc, allowInit } = options;
  const docFragment = doc.getXmlFragment();
  return {
    name: "yjs",
    onInitialized(editor: Editor) {
      const { state } = editor;

      function makeBlockyElementByYElement(
        yElement: Y.XmlElement
      ): BlockyElement {
        let result: BlockyElement;
        const children: BlockyNode[] = [];

        let childPtr = yElement.firstChild;
        while (childPtr) {
          if (childPtr instanceof Y.XmlElement) {
            const child = makeBlockyElementByYElement(childPtr);
            children.push(child);
          } else if (childPtr instanceof Y.XmlText) {
            const textModel = createBlockyTextModelByYText(editor, childPtr);
            children.push(textModel);
          }

          childPtr = childPtr.nextSibling;
        }

        const attribs = yElement.getAttributes();
        if (isUpperCase(yElement.nodeName)) {
          result = new BlockElement(
            yElement.nodeName,
            yElement.getAttribute("id"),
            attribs,
            children
          );
        } else {
          result = new BlockyElement(yElement.nodeName, attribs, children);
        }

        result.state = state;

        bindBlockyElement(editor, result, yElement);

        return result;
      }

      /**
       * Connect betweens [[BlockyElement]] and [[Y.XmlElement]]
       */
      function bindBlockyElement(
        editor: Editor,
        blockyElement: BlockyElement,
        yElement: Y.XmlElement
      ) {
        blockyElement.changed.on((e: ElementChangedEvent) => {
          withSilent(state, () => {
            switch (e.type) {
              case "element-insert-child": {
                const { child, index } = e;

                let element: Y.XmlElement | Y.XmlText;
                if (child instanceof BlockyElement) {
                  element = makeYElementByBlockyElement(child);
                } else if (child instanceof BlockyTextModel) {
                  element = createXmlTextByBlockyText(editor, child);
                } else {
                  return;
                }

                yElement.insert(index, [element]);

                break;
              }
              case "element-set-attrib": {
                yElement.setAttribute(e.key, e.value);
                break;
              }
              case "element-remove-child": {
                yElement.delete(e.index);
                break;
              }
            }
          });
        });

        yElement.observe((e: Y.YXmlEvent) => {
          withSilent(state, () => {
            const change = new Changeset(editor.state);
            e.attributesChanged.forEach((key) => {
              change.setAttribute(blockyElement, {
                [key]: yElement.getAttribute(key),
              });
            });

            // @ts-ignore
            if (e.childListChanged) {
              let index = 0;
              for (const delta of e.delta) {
                if (typeof delta.retain === "number") {
                  index += delta.retain;
                } else if (Array.isArray(delta.insert)) {
                  const blockyChildren: BlockyNode[] = [];
                  for (const xmlElement of delta.insert) {
                    const yXmlElement = xmlElement as Y.XmlElement;
                    const createdElement =
                      makeBlockyElementByYElement(yXmlElement);
                    blockyChildren.push(createdElement);
                  }
                  new Changeset(state).insertChildrenAt(
                    blockyElement,
                    index,
                    blockyChildren
                  );
                } else if (typeof delta.delete === "number") {
                  const numToDelete = delta.delete;
                  change.deleteChildrenAt(blockyElement, index, numToDelete);
                }
              }
            }

            change.apply();
          });
        });
      }

      const handleInsert = (index: number, elements: Y.XmlElement[]) => {
        const blockyChildren: BlockyElement[] = [];
        for (const element of elements) {
          const createdElement = makeBlockyElementByYElement(element);
          if (!createdElement) {
            continue;
          }

          blockyChildren.push(createdElement);
        }
        new Changeset(state)
          .insertChildrenAt(state.root, index, blockyChildren)
          .apply();
      };

      const handleDelete = (index: number, count: number) => {
        let ptr = state.root.firstChild;

        while (ptr) {
          if (index === 0) {
            break;
          }

          ptr = ptr.nextSibling;
          index--;
        }

        if (!ptr) {
          return;
        }

        const change = new Changeset(state);
        while (count > 0 && ptr) {
          const next: BlockyNode | null = ptr.nextSibling;
          change.removeChild(state.root, ptr);
          ptr = next;
          count--;
        }
        change.apply();
      };

      function makeYElementByBlockyElement(
        blockyElement: BlockyElement
      ): Y.XmlElement {
        const yElement = new Y.XmlElement(blockyElement.nodeName);

        const attributes = blockyElement.getAttributes();
        for (const [key, value] of Object.entries(attributes)) {
          yElement.setAttribute(key, value);
        }

        bindBlockyElement(editor, blockyElement, yElement);

        let childPtr = blockyElement.firstChild;
        const children: (Y.XmlElement | Y.XmlText)[] = [];
        while (childPtr) {
          if (childPtr instanceof BlockyElement) {
            const child = makeYElementByBlockyElement(childPtr);
            children.push(child);
          } else if (childPtr instanceof BlockyTextModel) {
            const textModel = createXmlTextByBlockyText(editor, childPtr);
            children.push(textModel);
          }

          childPtr = childPtr.nextSibling;
        }

        if (children.length > 0) {
          yElement.push(children);
        }

        return yElement;
      }

      if (allowInit) {
        withSilent(state, () => {
          let child = docFragment.firstChild;
          const change = new Changeset(state);
          while (child) {
            const element = makeBlockyElementByYElement(child as any);
            if (!element) {
              continue;
            }
            change.appendChild(state.root, element);
            child = child.nextSibling;
          }
          change.apply();
        });
      } else {
        // init from root

        withSilent(state, () => {
          let ptr = state.root.firstChild;

          const elements: (Y.XmlElement | Y.XmlText)[] = [];

          while (ptr !== null) {
            if (ptr instanceof BlockyElement) {
              const element = makeYElementByBlockyElement(ptr);
              elements.push(element);
            } else if (ptr instanceof BlockyTextModel) {
              const textModel = createXmlTextByBlockyText(editor, ptr);
              elements.push(textModel);
            }

            ptr = ptr.nextSibling;
          }

          docFragment.push(elements);
        });
      }

      docFragment.observe((e: Y.YXmlEvent) => {
        withSilent(state, () => {
          let ptr = 0;
          for (const d of e.delta) {
            if (typeof d.retain === "number") {
              ptr += d.retain;
            } else if (
              typeof d.insert !== "undefined" &&
              Array.isArray(d.insert)
            ) {
              handleInsert(ptr, d.insert);
            } else if (typeof d.delete === "number") {
              handleDelete(ptr, d.delete);
            }
          }
        });
      });

      state.root.changed.on((e) => {
        withSilent(state, () => {
          if (e.type === "element-insert-child") {
            const node = makeYElementByBlockyElement(e.child as any);
            docFragment.insert(e.index, [node]);
          } else if (e.type === "element-remove-child") {
            docFragment.delete(e.index);
          }
        });
      });
    },
  };
}
