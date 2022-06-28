import * as Y from "yjs";
import {
  type IPlugin,
  type Editor,
  type BlockyElement,
  type ElementChangedEvent, BlockyTextModel,
  type TextChangedEvent,
  type Block,
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

export function makeYjsPlugin(options: IYjsPluginOptions): IPlugin {
  const { doc, allowInit } = options;
  const docFragment = doc.getXmlFragment();
  const nodeToY = new Map<string, Y.XmlElement>();
  return {
    name: "yjs",
    onInitialized(editor: Editor) {
      let operating = false;

      /**
       * Connect betweens [[BlockyElement]] and [[Y.XmlElement]]
       */
      function bindContentElement(editor: Editor, blockyElement: BlockyElement, yElement: Y.XmlElement) {
        const attribs = blockyElement.getAttributes();
        for (const key in attribs) {
          yElement.setAttribute(key, attribs[key]);
        }

        blockyElement.onChanged.on((e: ElementChangedEvent) => {
          if (e.type === "element-set-attrib") {
            yElement.setAttribute(e.key, e.value);
          }
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

      function bindTextModel(editor: Editor, textModel: BlockyTextModel, yTextModel: Y.XmlText) {

        yTextModel.observe((e: Y.YTextEvent) => {
          if (operating) {
            return;
          }
          operating = true;
          try {
            editor.update(() => {
              handleDeltaForText(textModel, e.delta);
            });
          } finally {
            operating = false;
          }
        });

        textModel.onChanged.on((e: TextChangedEvent) => {
          if (operating) {
            return;
          }
          operating = true;
          try {
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
          } finally {
            operating = false;
          }
        });
      }

      const { state } = editor;

      const createBlockElementByXmlElement = (element: Y.XmlElement): BlockElement | undefined => {
          const blockName = element.getAttribute("blockName");
          const id = element.getAttribute("id");
          if (!id || !blockName) {
            return;
          }

          const contentXmlElement = element.firstChild as Y.XmlElement | undefined;
          if (!contentXmlElement) {
            return;
          }

          const createdElement = new BlockElement(blockName, id);

          const attribs = contentXmlElement.getAttributes();
          for (const key in attribs) {
            if (key === "id" || key === "blockName") {
              continue;
            }
            const value = attribs[key];
            createdElement.contentContainer.setAttribute(key, value);
          }

          let ptr = contentXmlElement.firstChild;
          while (ptr) {
            if (ptr instanceof Y.XmlText) {
              const blockyTextModel = new BlockyTextModel
              const deltas = ptr.toDelta();

              handleDeltaForText(blockyTextModel, deltas);
              bindTextModel(editor, blockyTextModel, ptr);
              createdElement.contentContainer.appendChild(blockyTextModel);
            }

            ptr = ptr.nextSibling;
          }

          return createdElement;
      }

      const handleInsert = (index: number, elements: Y.XmlElement[]) => {
        let ptr = state.root.firstChild;

        while (ptr && index > 0) {
          index--;
          ptr = ptr.nextSibling;
        }

        for (const element of elements) {
          const createdElement = createBlockElementByXmlElement(element);
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

      const handleDelete = (index: number) => {
        let ptr = state.root.firstChild;

        while (ptr) {
          if (index === 0) {
            state.root.removeChild(ptr);
            break;
          }

          ptr = ptr.nextSibling;
          index--;
        }
      };

      const handleNewBlockCreate = (block: Block) => {
        if (operating) {
          return;
        }
        operating = true;
        try {
          const blockElement: BlockElement = block.props;
          const element = new Y.XmlElement("block");
          element.setAttribute("blockName", blockElement.blockName);
          element.setAttribute("id", blockElement.id);

          const contentContainer = new Y.XmlElement("block-content");
          const childrenContainer = new Y.XmlElement("block-children");
          element.push([contentContainer, childrenContainer]);

          bindContentElement(editor, blockElement.contentContainer, contentContainer);

          const prevNode = blockElement.prevSibling as BlockElement | null;
          if (prevNode) {
            const prevYNode = nodeToY.get(prevNode.id);
            if (!prevYNode) {
              docFragment.push([element]);
              return;
            }
            docFragment.insertAfter(prevYNode, [element]);
          } else {
            docFragment.push([element]);
          }
        } finally {
          operating = false;
        }
      }

      if (allowInit) {
        operating = true;
        let child = docFragment.firstChild;
        while (child) {
          const element = createBlockElementByXmlElement(child as any);
          if (!element) {
            continue;
          }
          state.root.appendChild(element);
          child = child.nextSibling;
        }
        operating = false;
      } else {
        for (const block of state.blocks.values()) {
          handleNewBlockCreate(block);
        }
      }

      docFragment.observe((e: Y.YXmlEvent, t: Y.Transaction) => {
        if (operating) {
          return;
        }
        operating = true;
        let ptr = 0;
        try {
          editor.update(() => {
            for (const d of e.delta) {
              if (typeof d.retain === "number") {
                ptr += d.retain;
              } else if (typeof d.insert !== "undefined" && Array.isArray(d.insert)) {
                handleInsert(ptr, d.insert);
              } else if (typeof d.delete === "number") {
                handleDelete(d.delete);
              }
            }
          });
        } finally {
          operating = false;
        }
      });

      state.newBlockCreated.on(handleNewBlockCreate);

      state.blockDeleted.on((blockElement: BlockElement) => {
        if (operating) {
          return;
        }
        try {
          operating = true;
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
        } finally {
          operating = false;
        }
      });
    },
  };
}
