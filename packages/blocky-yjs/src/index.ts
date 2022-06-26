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

function bindTextModel(textModel: BlockyTextModel, yTextModel: Y.XmlText) {
  textModel.onChanged.on((e: TextChangedEvent) => {
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
}

/**
 * Connect betweens [[BlockyElement]] and [[Y.XmlElement]]
 */
function bindContentElement(blockyElement: BlockyElement, yElement: Y.XmlElement) {
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

      bindTextModel(textModel, yText);

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
      editor.state.newBlockInserted.on((blockElement: BlockElement) => {
        const element = new Y.XmlElement("block");
        element.setAttribute("blockName", blockElement.blockName);
        element.setAttribute("id", blockElement.id);

        const contentContainer = new Y.XmlElement("block-content");
        const childrenContainer = new Y.XmlElement("block-children");
        element.push([contentContainer, childrenContainer]);

        bindContentElement(blockElement.contentContainer, contentContainer);

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
      });
    },
  };
}
