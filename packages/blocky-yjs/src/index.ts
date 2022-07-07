import * as Y from "yjs";
import {
  type IPlugin,
  type Editor,
  type BlockyElement,
  type ElementChangedEvent, BlockyTextModel,
  type TextChangedEvent,
  type Block,
  type DocumentState,
  type BlockyNode,
  BlockElement,
} from "blocky-core";

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

function createXmlTextByBlockyText(textModel: BlockyTextModel): Y.XmlText {
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

export function makeYjsPlugin(options: IYjsPluginOptions): IPlugin {
  const { doc, allowInit } = options;
  const docFragment = doc.getXmlFragment();
  return {
    name: "yjs",
    onInitialized(editor: Editor) {
      const { state } = editor;

      /**
       * Connect betweens [[BlockyElement]] and [[Y.XmlElement]]
       */
      function bindContentElement(editor: Editor, blockyElement: BlockyElement, yElement: Y.XmlElement) {
        const attribs = blockyElement.getAttributes();
        for (const key in attribs) {
          yElement.setAttribute(key, attribs[key]);
        }

        blockyElement.onChanged.on((e: ElementChangedEvent) => {
          withSilent(state, () => {
            if (e.type === "element-set-attrib") {
              yElement.setAttribute(e.key, e.value);
            }
          });
        });

        yElement.observe((e: Y.YXmlEvent) => {
          withSilent(state, () => {
            editor.update(() => {
              e.attributesChanged.forEach(key => {
                blockyElement.setAttribute(key, yElement.getAttribute(key));
              });
            });
          });
        });

        let ptr = blockyElement.firstChild;
        const elements: (Y.XmlElement | Y.XmlText)[] = []
        while (ptr) {
          if (ptr.nodeName === "#text") {
            const textModel = ptr as BlockyTextModel;
            const yText = createXmlTextByBlockyText(textModel);

            bindTextModel(editor, textModel, yText);

            elements.push(yText);
          }

          ptr = ptr.nextSibling;
        }
        if (elements.length > 0) {
          yElement.push(elements);
        }
      }

      const createBlockElementByXmlElement = (editor: Editor, element: Y.XmlElement): BlockElement | undefined => {
          const blockName = element.getAttribute("blockName");
          const id = element.getAttribute("id");
          if (!id || !blockName) {
            return;
          }

          const createdElement = new BlockElement(blockName, id);
          createdElement.state = state;

          bindContentElement(editor, createdElement, element);

          const attribs = element.getAttributes();
          for (const key in attribs) {
            if (key === "id" || key === "blockName") {
              continue;
            }
            const value = attribs[key];
            createdElement.setAttribute(key, value);
          }

          let ptr = element.firstChild;
          while (ptr) {
            if (ptr instanceof Y.XmlText) {
              const blockyTextModel = new BlockyTextModel
              const deltas = ptr.toDelta();

              handleDeltaForText(blockyTextModel, deltas);
              bindTextModel(editor, blockyTextModel, ptr);
              createdElement.appendChild(blockyTextModel);
            }

            ptr = ptr.nextSibling;
          }

          return createdElement;
      }

      const handleInsert = (index: number, elements: Y.XmlElement[]) => {
        index--;
        let ptr = state.root.firstChild;

        while (ptr && index > 0) {
          index--;
          ptr = ptr.nextSibling;
        }

        for (const element of elements) {
          const createdElement = createBlockElementByXmlElement(editor, element);
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

      function findNodeById(id: string): Y.XmlElement | undefined {
        let ptr = docFragment.firstChild;

        while (ptr) {
          if (ptr.getAttribute("id") === id) {
            return ptr as Y.XmlElement;
          }

          ptr = ptr.nextSibling;
        }

        return;
      }

      const handleNewBlockCreate = (block: Block) => {
        withSilent(state, () => {
          const blockElement: BlockElement = block.props;
          const element = new Y.XmlElement("block");
          element.setAttribute("blockName", blockElement.blockName);
          element.setAttribute("id", blockElement.id);

          bindContentElement(editor, blockElement, element);

          const prevNode = blockElement.prevSibling as BlockElement | null;
          if (prevNode) {
            const prevYNode = findNodeById(prevNode.id);
            if (!prevYNode) {
              docFragment.push([element]);
              return;
            }
            docFragment.insertAfter(prevYNode, [element]);
          } else {
            docFragment.push([element]);
          }
        });
      }

      if (allowInit) {
        withSilent(state, () => {
          let child = docFragment.firstChild;
          while (child) {
            const element = createBlockElementByXmlElement(editor, child as any);
            if (!element) {
              continue;
            }
            state.root.appendChild(element);
            child = child.nextSibling;
          }
        });
      } else {
        for (const block of state.blocks.values()) {
          handleNewBlockCreate(block);
        }
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

      state.newBlockCreated.on(handleNewBlockCreate);

      state.blockDeleted.on((blockElement: BlockElement) => {
        withSilent(state, () => {
          let index = 0;
          const id = blockElement.id;
          let ptr = docFragment.firstChild;
          while (ptr) {
            if (ptr instanceof Y.XmlElement && ptr.nodeName === "block" && ptr.getAttribute("id") === id) {
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
