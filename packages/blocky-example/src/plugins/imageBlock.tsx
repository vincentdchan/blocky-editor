import { type Editor, type IPlugin } from "blocky-core";
import { makeReactBlock } from "blocky-preact";
import { Component } from "preact";

export const ImageBlockName = "image";

class ImageBlock extends Component {

  render() {
    return (<div className="blocky-image-block"></div>);
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
