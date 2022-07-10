import * as Y from "yjs";
import {
  type IPlugin,
  type Editor, BlockyElement,
  type ElementChangedEvent, BlockyTextModel,
  type TextChangedEvent,
  type DocumentState,
  type BlockyNode,
  BlockElement,
} from "blocky-core";
import { isUpperCase } from "blocky-common/es/character";

export interface IYjsPluginOptions {
  doc: Y.Doc;
  allowInit?: boolean;
}

function handleDeltaForText(textModel: BlockyTextModel, deltas: any[]) {
  let ptr = 0;
  for (const d of deltas) {
    if (typeof d.retain !== "undefined") {
      if (typeof d.attributes === "object") {
        textModel.format(ptr, d.retain, d.attributes);
      }
      ptr += d.retain;
    } else if (typeof d.insert === "string") {
      textModel.insert(ptr, d.insert, d.attributes);
      ptr += d.insert.length;
    } else if (typeof d.delete === "number") {
      textModel.delete(ptr, d.delete);
    }
  }
}

function createXmlTextByBlockyText(editor: Editor, textModel: BlockyTextModel): Y.XmlText {
  const result = new Y.XmlText(textModel.toString());

  let index = 0;
  let ptr = textModel.nodeBegin;
  while (ptr) {
    if (ptr.attributes) {
      result.format(index, ptr.content.length, ptr.attributes);
    }
    index += ptr.content.length;
    ptr = ptr.next;
  }

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

function bindTextModel(editor: Editor, textModel: BlockyTextModel, yTextModel: Y.XmlText) {
  const { state } = editor;
  yTextModel.observe((e: Y.YTextEvent) => {
    withSilent(state, () => {
      editor.update(() => {
        handleDeltaForText(textModel, e.delta);
      });
    });
  });

  textModel.onChanged.on((e: TextChangedEvent) => {
    withSilent(state, () => {
      switch (e.type) {
        case "text-insert": {
          yTextModel.insert(e.index, e.text, e.attributes);
          break;
        }

        case "text-format": {
          yTextModel.format(e.index, e.length, e.attributes!);
          break;
        }

        case "text-delete": {
          yTextModel.delete(e.index, e.length);
          break;
        }
      }
    });
  });
}

function createBlockyTextModelByYText(editor: Editor, yText: Y.XmlText): BlockyTextModel {
  const result = new BlockyTextModel();

  const delta = yText.toDelta();

  let index: number = 0;
  for (const d of delta) {
    if (typeof d.retain === "number") {
      index += d.retain
    } else if (typeof d.insert === "string") {
      result.insert(index, d.insert, d.attributes);
      index += d.insert.length;
    }
  }

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

      function makeBlockyElementByYElement(yElement: Y.XmlElement): BlockyElement {
        let result: BlockyElement;

        if (isUpperCase(yElement.nodeName)) {
          result = new BlockElement(yElement.nodeName, yElement.getAttribute("id"));
        } else {
          result = new BlockyElement(yElement.nodeName);
        }

        result.state = state;

        const attribs = yElement.getAttributes();
        for (const key in attribs) {
          const value = attribs[key];
          if (value) {
            result.setAttribute(key, value);
          }
        }

        let childPtr = yElement.firstChild;
        while (childPtr) {
          if (childPtr instanceof Y.XmlElement) {
            const child = makeBlockyElementByYElement(childPtr);
            result.appendChild(child);
          } else if (childPtr instanceof Y.XmlText) {
            const textModel = createBlockyTextModelByYText(editor, childPtr);
            result.appendChild(textModel);
          }

          childPtr = childPtr.nextSibling;
        }

        bindBlockyElement(editor, result, yElement);

        return result;
      }

      /**
       * Connect betweens [[BlockyElement]] and [[Y.XmlElement]]
       */
      function bindBlockyElement(editor: Editor, blockyElement: BlockyElement, yElement: Y.XmlElement) {
        blockyElement.onChanged.on((e: ElementChangedEvent) => {
          withSilent(state, () => {
            switch (e.type) {
              case "element-insert-child": {
                const { child } = e;
                const index = e.getInsertIndex();
                const element = new Y.XmlElement(child.nodeName);
                yElement.insert(index, [element]);

                if (child instanceof BlockElement) {
                  bindBlockyElement(editor, child, element);
                }

                break;
              }
              case "element-set-attrib": {
                yElement.setAttribute(e.key, e.value);
                break;
              }
            }
          });
        });

        yElement.observe((e: Y.YXmlEvent) => {
          withSilent(state, () => {
            editor.update(() => {
              e.attributesChanged.forEach(key => {
                blockyElement.setAttribute(key, yElement.getAttribute(key));
              });

              // @ts-ignore
              if (e.childListChanged) {
                let index = 0;
                for (const delta of e.delta) {
                  if (typeof delta.retain === "number") {
                    index += delta.retain;
                  } else if (Array.isArray(delta.insert)) {
                    for (const xmlElement of delta.insert) {
                      const yXmlElement = xmlElement as Y.XmlElement;

                      const createdElement = makeBlockyElementByYElement(yXmlElement);

                      blockyElement.insertChildAt(index, createdElement);

                      index++;
                    }
                  }
                }
              }
            });
          });
        });
      }

      const handleInsert = (index: number, elements: Y.XmlElement[]) => {
        index--;
        let ptr = state.root.firstChild;

        while (ptr && index > 0) {
          index--;
          ptr = ptr.nextSibling;
        }

        for (const element of elements) {
          const createdElement = makeBlockyElementByYElement(element);
          if (!createdElement) {
            continue;
          }

          if (ptr) {
            state.root.insertAfter(createdElement, ptr);
          } else {
            state.root.appendChild(createdElement);
          }

          ptr = createdElement;
        }
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

        while (count > 0 && ptr) {
          const next: BlockyNode | null = ptr.nextSibling;
          state.root.removeChild(ptr);
          ptr = next;
          count--;
        }
      };

      function makeYElementByBlockyElement(blockyElement: BlockyElement): Y.XmlElement {
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
          while (child) {
            const element = makeBlockyElementByYElement(child as any);
            if (!element) {
              continue;
            }
            state.root.appendChild(element);
            child = child.nextSibling;
          }
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

      docFragment.observe((e: Y.YXmlEvent, t: Y.Transaction) => {
        withSilent(state, () => {
          editor.update(() => {
            let ptr = 0;
            for (const d of e.delta) {
              if (typeof d.retain === "number") {
                ptr += d.retain;
              } else if (typeof d.insert !== "undefined" && Array.isArray(d.insert)) {
                handleInsert(ptr, d.insert);
              } else if (typeof d.delete === "number") {
                handleDelete(ptr, d.delete);
              }
            }
          });
        });
      });

      // state.newBlockCreated.on(handleNewBlockCreate);

      state.root.onChanged.on(e => {
        withSilent(state, () => {
          if (e.type === "element-insert-child") {
            const node = makeYElementByBlockyElement(e.child as any);
            const index = e.getInsertIndex();
            docFragment.insert(index, [node]);
          }
        });
      });

      state.blockDeleted.on((blockElement: BlockElement) => {
        withSilent(state, () => {
          let index = 0;
          const id = blockElement.id;
          let ptr = docFragment.firstChild;
          while (ptr) {
            if (ptr instanceof Y.XmlElement && isUpperCase(ptr.nodeName) && ptr.getAttribute("id") === id) {
              break;
            }
            index++;
            ptr = ptr.nextSibling;
          }
          if (!ptr) {
            return;
          }
          docFragment.delete(index, 1);
        });
      });
    },
  };
}
