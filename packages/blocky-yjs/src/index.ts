import * as Y from "yjs";
import {
  type IPlugin,
  type Editor,
  type BlockElement,
  type BlockyElement,
} from "blocky-core";

export interface IYjsPluginOptions {
  doc: Y.Doc;
}

function bindElement(blockyElement: BlockyElement, yElement: Y.XmlElement) {
  /** unimplemented */
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

        bindElement(blockElement.contentContainer, contentContainer);

        const prevNode = blockElement.prevSibling as BlockElement | null;
        if (prevNode) {
          const prevYNode = nodeToY.get(prevNode.id);
          if (!prevYNode) {
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
