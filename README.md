
# Blocky Editor

Blocky Editor is an editor which supports the concept of blocks. It can help you to build an editor like Notion. It's tiny, fast and extensible. You can extend it with blocks.

## Features

- Extremely small.
- Extensible. Extend the editor with custom blocks and spans.
- Static typed.

## Packages

- Common: Provide the common utilities used by the editor.
- Core: Written in VanillaJS. Can be used standalone without any 
  UI frameworks.
- Preact: Wrap the editor in [Preact](https://preactjs.com/). Provide the UI facilities such
  toolbar and banner.
- Example: The example to demonstrate how to use the editor.

## Compatibility

Tested on

- Google Chrome
- Microsoft Edge
- Safari

## FAQ

### Why does it use Preact instead of React?

Because it's small. React and ReactDOM costs nearly 47kb after minified
and gzipped. And Preact costs 4kb.
I want the size of the editor to be as small as possible.

And Preact is closer to the DOM.
React has an abstract layer for event handling, which is complicated and useless for the editor.

Actually, you can wrap the editor in React/Vue/Angular.
It's easy to do that.
I don't have time to do that and [Preact](https://preactjs.com/) is good enough for me.
