import { BlockDataElement } from "blocky-data";
import { type TryParsePastedDOMEvent, type IPlugin } from "blocky-core";
import {
  makeReactBlock,
  DefaultBlockOutline,
  type ReactBlockRenderProps,
} from "blocky-react";
import { type RefObject, createRef, PureComponent } from "react";
import Button from "@pkg/components/button";
import "./imageBlock.scss";

export const ImageBlockName = "Image";

interface ImageBlockProps {
  blockElement: BlockDataElement;
}

interface ImageBlockState {
  data?: string;
}

class ImageBlock extends PureComponent<ImageBlockProps, ImageBlockState> {
  private selectorRef: RefObject<HTMLInputElement> = createRef();

  constructor(props: ImageBlockProps) {
    super(props);

    this.state = {
      data: props.blockElement.getAttribute("src"),
    };
  }

  private handleUpload = () => {
    this.selectorRef.current!.click();
  };

  private handleSelectedFileChanged = () => {
    const files = this.selectorRef.current!.files;
    if (!files || files.length === 0) {
      return;
    }
    const fr = new FileReader();
    fr.onload = () => {
      this.setState({
        data: fr.result as string,
      });
    };
    fr.readAsDataURL(files[0]);
  };

  override componentWillUnmount() {
    console.log("image unmounted");
  }

  renderBlockContent() {
    const { data } = this.state;
    if (typeof data === "undefined") {
      return (
        <>
          <Button onClick={this.handleUpload}>Upload</Button>
          <input
            type="file"
            accept=".jpg, .png, .jpeg, .gif, .bmp, .tif, .tiff|image/*"
            className="blocky-image-block-file-selector"
            onChange={this.handleSelectedFileChanged}
            ref={this.selectorRef}
          />
        </>
      );
    }

    return <img src={data} alt="" />;
  }

  render() {
    return (
      <DefaultBlockOutline>
        <div className="blocky-image-block">{this.renderBlockContent()}</div>
      </DefaultBlockOutline>
    );
  }
}

export function makeImageBlockPlugin(): IPlugin {
  return {
    name: ImageBlockName,
    blocks: [
      makeReactBlock({
        name: ImageBlockName,
        component: (props: ReactBlockRenderProps) => (
          <ImageBlock blockElement={props.blockElement} />
        ),
        tryParsePastedDOM(e: TryParsePastedDOMEvent) {
          const { node, editorController } = e;
          const img = node.querySelector("img");
          if (img) {
            const newId = editorController.idGenerator.mkBlockId();
            const src = img.getAttribute("src");
            let attributes: object | undefined;
            if (src) {
              attributes = {
                src: src,
              };
            }
            const element = new BlockDataElement(ImageBlockName, newId, attributes);
            return element;
          }
        },
      }),
    ],
  };
}
