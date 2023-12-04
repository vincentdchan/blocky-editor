import ImageBlock, { ImageBlockPlaceholderRenderer } from "./imageBlock";
import {
  type TryParsePastedDOMEvent,
  type IPlugin,
  type IBlockDefinition,
  type BlockyPasteEvent,
  PluginContext,
  bky,
} from "blocky-core";
import { makeReactBlock, type ReactBlockRenderProps } from "../../";
import { Observable, takeUntil } from "rxjs";

const defaultMinWidth = 100;

export interface ImageBlockOptions {
  minWidth?: number;
  placeholder: ImageBlockPlaceholderRenderer;
}

export class ImageBlockPlugin implements IPlugin {
  static Name = "Image";
  static LoadImage(
    blob: Blob
  ): Observable<string | ArrayBuffer | null | undefined> {
    return new Observable((subscriber) => {
      const reader = new FileReader();
      reader.onload = function (event) {
        subscriber.next(event.target?.result);
        subscriber.complete();
      }; // data url!
      reader.onerror = function (err) {
        subscriber.error(err);
      };
      reader.readAsDataURL(blob);
    });
  }

  name = ImageBlockPlugin.Name;
  blocks: IBlockDefinition[];

  constructor(public options: ImageBlockOptions) {
    const { placeholder } = options;
    this.blocks = [
      makeReactBlock({
        name: ImageBlockPlugin.Name,
        component: (props: ReactBlockRenderProps) => (
          <ImageBlock
            minWidth={options.minWidth ?? defaultMinWidth}
            blockElement={props.blockElement}
            placeholder={placeholder}
          />
        ),
        tryParsePastedDOM(e: TryParsePastedDOMEvent) {
          const { node } = e;
          const img = node.querySelector("img");
          if (img) {
            const src = img.getAttribute("src");
            const attributes = src ? { src } : undefined;
            const element = bky.element(ImageBlockPlugin.Name, attributes);
            return element;
          }
        },
      }),
    ];
  }

  onPaste(evt: BlockyPasteEvent) {
    const items = evt.raw.clipboardData?.items;
    if (!items) {
      return;
    }
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        this.readPasteItemAsFile(evt.ctx, item);
      }
    }
  }

  readPasteItemAsFile(ctx: PluginContext, item: DataTransferItem) {
    const blob = item.getAsFile();
    if (!blob) {
      return;
    }
    const editorController = ctx.editor.controller;
    ImageBlockPlugin.LoadImage(blob)
      .pipe(takeUntil(ctx.dispose$))
      .subscribe((url) => {
        const element = bky.element(ImageBlockPlugin.Name, {
          src: url,
        });
        editorController.pasteElementsAtCursor([element]);
      });
  }
}
