# How to write a block

You can use the plugin mechanism to extend the editor with
your custom block.

## VanillaJS

To implement a block, you need to implement two interfaces.

**Define the block**

You should implement the interface `IBlockDefinition`.

```typescript
import {
  type IBlockDefinition,
  type EditorController,
  type BlockData,
  type BlockCreatedEvent,
  Block,
} from "blocky-core";

class MyBlock extends Block {
  /**
   * Get the data of the block.
   */
  get elementData(): BlockyElement;

  /** The methods to implement **/
  /** render your dom when the block is mounted */
  blockDidMount(e: BlockDidMountEvent): void;

  /**
   * Handle the block is focused.
   *
   * This hook will only be triggered when the focused id is
   * equal to the block'id. The children is out of situation.
   *
   */
  blockFocused?(e: BlockFocusedEvent): void;

  /**
   * Triggered when the block is blur.
   */
  blockBlur?(e: BlockBlurEvent): void;

  /**
   * Triggered when the renderer re-render the block.
   */
  render?(container: HTMLElement): void;

  /**
   * Clean something when the block is unmounted.
   */
  dispose() {
    /** TODO: clean */
    super.dispose();
  }
}

export function makeMyBlock(): IBlockDefinition {
  return {
    name: "plugin-name",
    editable: false,
    onBlockCreated({ model }: BlockCreatedEvent): Block {
      /** control how the block is created **/
      return new MyBlock();
    },
  };
}
```

## Write a block in Preact

Implementing a block in Preact is more easier.

```tsx
import { type Editor, type IPlugin } from "blocky-core";
import { makeReactBlock, DefaultBlockOutline } from "blocky-preact";

export function makeMyBlockPlugin(): IPlugin {
  return {
    name: "plugin-name",
    blocks: [
      makeReactBlock({
        name: "BlockName",
        component: () => (
          <DefaultBlockOutline>Write the block in Preact</DefaultBlockOutline>
        ),
      }),
    ],
  };
}
```

## Add the plugin to the controller

```tsx
function makeController(): EditorController {
  return new EditorController({
    plugins: [
      /** ... */
      makeMyBlockPlugin(),
    ],
    /** ... */
  });
}
```
