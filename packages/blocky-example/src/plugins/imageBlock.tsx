import { JSX, type RefObject, createRef } from "preact";
import { BlockElement } from "blocky-data";
import { type TryParsePastedDOMEvent, type IPlugin } from "blocky-core";
import { makeReactBlock, DefaultBlockOutline } from "blocky-preact";
import { PureComponent } from "preact/compat";
import Button from "@pkg/components/button";
import "./imageBlock.scss";

export const ImageBlockName = "Image";

interface ResizeHandleProps {
  style?: JSX.CSSProperties;
  resizeHovered?: boolean;
  onMouseEnter?: (e: JSX.TargetedMouseEvent<HTMLElement>) => void;
  onMouseLeave?: (e: JSX.TargetedMouseEvent<HTMLElement>) => void;
  onMouseDown?: (e: JSX.TargetedMouseEvent<HTMLElement>) => void;
  onMouseUp?: (e: JSX.TargetedMouseEvent<HTMLElement>) => void;
}

function ResizeHandle(props: ResizeHandleProps) {
  const { resizeHovered, ...rest } = props;
  let cls = "image-resize-handle";
  if (resizeHovered) {
    cls += " hover";
  }
  return <div className={cls} {...rest} />;
}

interface ImageBlockProps {
  blockElement: BlockElement;
}

interface ImageBlockState {
  hovered: boolean;
  resizeHandleHovered: boolean;
  data?: string;
  imageWidth?: number;
}

class ImageBlock extends PureComponent<ImageBlockProps, ImageBlockState> {
  #selectorRef: RefObject<HTMLInputElement> = createRef();
  #imageRef: RefObject<HTMLImageElement> = createRef();

  constructor(props: ImageBlockProps) {
    super(props);

    this.state = {
      hovered: false,
      resizeHandleHovered: false,
      data: props.blockElement.getAttribute("src"),
    };
  }

  #handleUpload = () => {
    this.#selectorRef.current!.click();
  };

  #handleSelectedFileChanged = () => {
    const files = this.#selectorRef.current!.files;
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

  #handleResizeEnter = () => {
    this.setState({
      resizeHandleHovered: true,
    });
  };

  #handleResizeLeave = () => {
    this.setState({
      resizeHandleHovered: false,
    });
  };

  #mouseDownX = 0;
  #imageMaxWidth = 0;

  #handleMouseDown = (evt: JSX.TargetedMouseEvent<HTMLElement>) => {
    const currentElement = this.#imageRef.current;
    if (!currentElement) {
      return;
    }
    const imageWidth = (this.#imageMaxWidth =
      currentElement.getBoundingClientRect().width);
    this.#mouseDownX = evt.clientX;
    window.addEventListener("mousemove", this.#handleMouseMoved);
    window.addEventListener("mouseup", this.#handleMouseUp);
    this.setState({ imageWidth });
  };

  #handleMouseUp = (evt: MouseEvent) => {
    window.removeEventListener("mousemove", this.#handleMouseMoved);
    window.removeEventListener("mouseup", this.#handleMouseUp);
  };

  #handleMouseMoved = (evt: MouseEvent) => {
    evt.preventDefault();
    const { imageWidth } = this.state;
    if (!imageWidth) {
      return;
    }
    const deltaX = evt.clientX - this.#mouseDownX;
    this.#mouseDownX = evt.clientX;

    const newWidth = Math.min(this.#imageMaxWidth, imageWidth + deltaX);
    this.setState({
      imageWidth: newWidth,
    });
  };

  #renderBlockContent() {
    const { data, hovered, resizeHandleHovered } = this.state;
    if (typeof data === "undefined") {
      return (
        <>
          <Button onClick={this.#handleUpload}>Upload</Button>
          <input
            type="file"
            accept=".jpg, .png, .jpeg, .gif, .bmp, .tif, .tiff|image/*"
            className="blocky-image-block-file-selector"
            onChange={this.#handleSelectedFileChanged}
            ref={this.#selectorRef}
          />
        </>
      );
    }

    return (
      <>
        {hovered && (
          <>
            <ResizeHandle
              resizeHovered={resizeHandleHovered}
              onMouseEnter={this.#handleResizeEnter}
              onMouseLeave={this.#handleResizeLeave}
              onMouseDown={this.#handleMouseDown}
              onMouseUp={this.#handleMouseUp}
              style={{ left: 16 }}
            />
            <ResizeHandle
              resizeHovered={resizeHandleHovered}
              onMouseEnter={this.#handleResizeEnter}
              onMouseLeave={this.#handleResizeLeave}
              onMouseDown={this.#handleMouseDown}
              onMouseUp={this.#handleMouseUp}
              style={{ right: 16 }}
            />
          </>
        )}
        <img src={data} alt="" ref={this.#imageRef} />
      </>
    );
  }

  #handleMouseEnter = () => {
    this.setState({
      hovered: true,
    });
  };

  #handleMouseLeave = () => {
    this.setState({
      hovered: false,
    });
  };

  render() {
    const { imageWidth } = this.state;
    return (
      <DefaultBlockOutline
        onMouseEnter={this.#handleMouseEnter}
        onMouseLeave={this.#handleMouseLeave}
        style={{
          width: imageWidth,
        }}
      >
        <div className="blocky-image-block">{this.#renderBlockContent()}</div>
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
        contentClassnames: ["image-center"],
        component: (data: BlockElement) => <ImageBlock blockElement={data} />,
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
            const element = new BlockElement(ImageBlockName, newId, attributes);
            return element;
          }
        },
      }),
    ],
  };
}
