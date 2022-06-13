import { type IBlockDefinition, BlockContentType } from "blocky-core";
import { render as reactRender, type ComponentChild } from "preact";

export interface ReactBlockOptions {
  name: string;
  component: () => ComponentChild;
}

/**
 * This method is used connect between blocky-core and preact.
 * Help to write a block in React's style.
 */
export function makeReactBlock(options: ReactBlockOptions): IBlockDefinition {
  const { name, component } = options;
  let renderedComponent: ComponentChild | undefined;
  return {
    name,
    type: BlockContentType.Custom,
    render(container: HTMLElement) {
      if (!renderedComponent) {
        renderedComponent = component();
      }
      reactRender(renderedComponent, container);
    },
  };
}
