import type { BlockElement } from "blocky-data";
import {
  type IBlockDefinition,
  type EditorController,
  ContentBlock,
  TryParsePastedDOMEvent,
} from "blocky-core";
import React, { createContext } from "react";
import { createRoot, type Root } from "react-dom/client"

export interface ReactBlockRenderProps {
  controller: EditorController;
  blockElement: BlockElement;
}

export interface ReactBlockOptions {
  name: string;
  component: (props: ReactBlockRenderProps) => React.ReactNode;
  tryParsePastedDOM?(e: TryParsePastedDOMEvent): BlockElement | void;
}

export interface IReactBlockContext {
  editorController: EditorController;
  blockId: string;
}

export const ReactBlockContext = createContext<IReactBlockContext | undefined>(
  undefined
);

/**
 * This method is used connect between blocky-core and preact.
 * Help to write a block in React's style.
 */
export function makeReactBlock(options: ReactBlockOptions): IBlockDefinition {
  const { name, tryParsePastedDOM } = options;
  return class ReactBlock extends ContentBlock {
    static Name = name;
    static Editable = false;
    static TryParsePastedDOM =
      tryParsePastedDOM && tryParsePastedDOM.bind(options);

    #rendered: Root | undefined;

    override render() {
      const { component } = options;
      this.#rendered = createRoot(this.contentContainer);
      const editorController = this.editor.controller;
      this.#rendered.render(
        <ReactBlockContext.Provider
          value={{ editorController, blockId: this.props.id }}
        >
          {component({
            controller: this.editor.controller,
            blockElement: this.props,
          })}
        </ReactBlockContext.Provider>,
      );
    }

    dispose() {
      if (this.#rendered) {
        this.#rendered.unmount();
        this.#rendered = undefined;
      }
      super.dispose();
    }
  };
}
