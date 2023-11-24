# Blocky Editor

Blocky Editor is an editor which supports the concept of blocks. It can help you to build an editor like Notion. It's tiny, fast and extensible. You can extend it with blocks.

| [Demo](https://blocky-editor.dev/)
| [Documentations](https://blocky-editor.dev/doc/get-started)
|

## Why?

The main goal of this project is to provide an editor which is small and fast enough to be embedded in Notion-like apps.

It doesn't depend on any heavy editor framework, and it handles the complex text-editing details for you.

The developers only need to develop their blocks with their favourite UI frameworks.

## Features

- Extremely small.
- Extensible. Extend the editor with custom blocks and spans.
- Static typed.
- Collaborative editing.

## Packages

![](./packages/blocky-example/public/arch.png)

- Core(![npm](https://img.shields.io/npm/v/blocky-core)): The core of the editor. Written in vanilla JS. It can be used standalone without any
  UI frameworks.
  - Gzipped size: ~40kb
- React bindings(![npm](https://img.shields.io/npm/v/blocky-react)): Wrap the editor in [React](https://react.dev/). Provide the UI facilities such as
  toolbar and spanner.
  - Gzipped size(including Core): ~48kb
- [Example](https://blocky-editor.dev/): The example to demonstrate how to use the editor.

## Resources

- [Get started](https://blocky-editor.dev/doc/get-started)
- [Contributing](./CONTRIBUTING.md)

## Products

- [CubyText](https://github.com/vincentdchan/CubyText)

## Compatibility

Tested on

- Google Chrome
- Microsoft Edge
- Safari
