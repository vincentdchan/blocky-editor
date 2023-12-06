# Builtin plugins

## Spanner Plugin

A spanner is the plugin that will follow the blocks. It's used to render the menu for the blocks.

You can also drag the spanner to move the blocks.

![](/spanner.gif)

The `blocky-react` package provides a default spanner. You can use it by calling `makeDefaultReactSpanner()`.

```typescript
import { makeDefaultReactSpanner, } from "blocky-react";

new SpannerPlugin({
  factory: makeDefaultReactSpanner(),
}),
```

## Undo Plugin

The undo plugin is used to provide undo/redo functionality.
Is's enabled **by default**.

If you have you own undo/redo functionality, you can disable it by calling `unload` on the pluginRegistry

```typescript
editorController.pluginRegistry.unload("undo");
```

## Text block

Text block is built in. It's the most important block in the BlockyEditor. You don't need to do anything to load it.

It handles the basic text rendering and editing stuff.

Data definitions:

```typescript
interface TextBlockAttributes {
  textType: TextType;
  checked?: boolean /** used for checkbox */;
}
```

Builtin types:

- Quoted
- Checkbox
- Numbered
- Bulleted
- Normal
- Heading1
- Heading2
- Heading3
