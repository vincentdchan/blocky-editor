import { type Editor, type IPlugin } from "blocky-core";
import { makeReactBlock, DefaultBlockOutline } from "blocky-preact";
import { Component } from "preact";
import "./imageBlock.scss";

export const ImageBlockName = "image";

class ImageBlock extends Component {

  render() {
    return (
      <DefaultBlockOutline>
        <div className="blocky-image-block">
          <button>Upload</button>
        </div>
      </DefaultBlockOutline>
    );
  }

}

export function makeImageBlockPlugin(): IPlugin {
  return {
    name: ImageBlockName,
    onInitialized(editor: Editor) {
      editor.registry.block.register(makeReactBlock({
        name: ImageBlockName,
        component: () => <ImageBlock />,
      }));
    },
  };
}
