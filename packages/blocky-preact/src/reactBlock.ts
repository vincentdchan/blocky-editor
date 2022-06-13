import { type IBlockDefinition, BlockContentType } from "blocky-core";
import { render as reactRender, type ComponentChild } from "preact";

export interface ReactBlockOptions {
  name: string;
  component: ComponentChild;
}

export function makeReactBlock(options: ReactBlockOptions): IBlockDefinition {
  const { name, component } = options;
  return {
    name,
    type: BlockContentType.Custom,
    render(container: HTMLElement) {
      reactRender(component, container);
    },
  };
}
