import * as Y from "yjs";
import {
  type IPlugin,
  type Editor,
  type BlockElement,
  type BlockyElement,
  type ElementChangedEvent,
  type BlockyTextModel,
  type TextChangedEvent,
} from "blocky-core";

export interface IYjsPluginOptions {
  doc: Y.Doc;
}

/**
 * TODO: will unobserve hurts performance?
 */
function bindTextModel(editor: Editor, textModel: BlockyTextModel, yTextModel: Y.XmlText) {
  let operating = false;

  yTextModel.observe((e: Y.YTextEvent) => {
    if (operating) {
      return;
    }
    operating = true;
    try {
      editor.update(() => {
        let ptr = 0;
        for (const d of e.delta) {
          if (typeof d.retain !== "undefined") {
            if (typeof d.attributes === "object") {
              textModel.format(ptr, d.retain, d.attributes);
            }
            ptr += d.retain;
            break;
          }
          if (typeof d.insert === "string") {
            textModel.insert(ptr, d.insert);
            break;
          }
          if (typeof d.delete === "number") {
            textModel.delete(ptr, d.delete);
            break;
          }
        }
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
      const yText = new Y.XmlText(textModel.toString());

      bindTextModel(editor, textModel, yText);

      elements.push(yText);
    }

    ptr = ptr.nextSibling;
  }
  if (elements.length > 0) {
    yElement.push(elements);
  }
}

export function makeYjsPlugin(options: IYjsPluginOptions): IPlugin {
  const { doc } = options;
  const docFragment = doc.getXmlFragment();
  const nodeToY = new Map<string, Y.XmlElement>();
  return {
    name: "yjs",
    onInitialized(editor: Editor) {
      let operating = false;
      docFragment.observe((e: Y.YXmlEvent, t: Y.Transaction) => {
        if (operating) {
          return;
        }
        operating = true;
        try {
        } finally {
          operating = false;
        }
      });
      editor.state.newBlockInserted.on((blockElement: BlockElement) => {
        if (operating) {
          return;
        }
        operating = true;
        try {
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
      });
    },
  };
}
