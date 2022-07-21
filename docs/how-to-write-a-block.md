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
  /** override the methods **/
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
