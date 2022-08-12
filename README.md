# Blocky Editor

Blocky Editor is an editor which supports the concept of blocks. It can help you to build an editor like Notion. It's tiny, fast and extensible. You can extend it with blocks.

[Demo](https://blocky-editor.dev/)

## Features

- Extremely small.
- Extensible. Extend the editor with custom blocks and spans.
- Static typed.
- Collaborative editing.

## Packages

![](./packages/blocky-example/src/arch.png)

- Data(![npm](https://img.shields.io/npm/v/blocky-data)): The data structure of the editor. Can be used without browser environment.
- Core(![npm](https://img.shields.io/npm/v/blocky-core)): The core of the editor. Written in vanilla JS. It can be used standalone without any
  UI frameworks.
  - Gzipped size: ~32kb
- Preact(![npm](https://img.shields.io/npm/v/blocky-preact)): Wrap the editor in [Preact](https://preactjs.com/). Provide the UI facilities such as
  toolbar and banner.
- [Example](https://blocky-editor.dev/): The example to demonstrate how to use the editor.
  - Gzipped size: ~46kb (one-time loading)

## Resources

- [Get started](./docs/get-started.md)
- [How to write a block](./docs/how-to-write-a-block.md)
- [Data manipulation](./docs/data-manipulation.md)
- [Follower widget](./docs/follower-widget.md)

## Compatibility

Tested on

- Google Chrome
- Microsoft Edge
- Safari

## FAQ

### Why does it use Preact instead of React?

Because it's small.
React(used with ReactDOM) costs nearly 47kb after minified
and gzipped. And Preact costs 4kb.
I want the size of the editor to be as small as possible.

And Preact is closer to the DOM.
React has an abstract layer for event handling, which is complicated and useless for the editor.

Actually, you can wrap the editor in React/Vue/Angular.
It's easy to do that.
I don't have time to do that, and [Preact](https://preactjs.com/) is good enough for me.
