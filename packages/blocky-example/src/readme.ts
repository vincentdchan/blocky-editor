import ArchImageUrl from "./arch.png?url";

export const ReadMeContent = `
<p>Blocky Editor is an editor which supports the concept of blocks. It can help you to build an editor like Notion. It's tiny, fast and extensible. You can extend it with blocks.</p>
<h2>Features</h2>
<ul>
  <li>Extremely small.</li>
  <li>Extensible. Extend the editor with custom blocks and spans.</li>
  <li>Static typed.</li>
</ul>
<h2>Packages</h2>
<p>
  <img src=${ArchImageUrl} />
</p>
<ul>
  <li>Common: Provide the common utilities used by the editor.</li>
  <li>Preact: Wrap the editor in <a href="https://preactjs.com/">Preact</a>. Provide the UI facilities such as toolbar and banner.</li>
  <li>Example: The example to demonstrate how to use the editor.</li>
</ul>
<h2>Resources</h2>
<ul>
  <li><a href="https://github.com/vincentdchan/blocky-editor/blob/master/docs/get-started.md">Get started</a></li>
  <li><a href="https://github.com/vincentdchan/blocky-editor/blob/master/docs/how-to-write-a-block.md">How to write a block</a></li>
</ul>
<h2>Compatibility</h2>
<p>Tested on</p>
<ul>
  <li>Google Chrome</li>
  <li>Microsoft Edge</li>
  <li>Safari</li>
</ul>
<h2>FAQ</h2>
<h3>Why does it use Preact instead of React?</h3>
<p>
Because it's small. React(used with ReactDOM) costs nearly 47kb after minified
and gzipped. And Preact costs 4kb.
I want the size of the editor to be as small as possible.
</p>
<p>
And Preact is closer to the DOM.
React has an abstract layer for event handling, which is complicated and useless for the editor.
</p>
<p>
Actually, you can wrap the editor in React/Vue/Angular.
It's easy to do that.
I don't have time to do that, and <a href="https://preactjs.com/">Preact</a> is good enough for me.
</p>
`;
