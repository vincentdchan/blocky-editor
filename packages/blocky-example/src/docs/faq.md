# FAQ

## Why does it use Preact instead of React?

Because it's small.
React(used with ReactDOM) costs nearly 47kb after minified
and gzipped. And Preact costs 4kb.
I want the size of the editor to be as small as possible.

And Preact is closer to the DOM.
React has an abstract layer for event handling, which is complicated and unnecessary for the editor.

Actually, you can wrap the editor in React/Vue/Angular.
It's easy to do that.
I don't have time to do that, and [Preact](https://preactjs.com/) is good enough for me.
