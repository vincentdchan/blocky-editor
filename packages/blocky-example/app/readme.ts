export const ReadMeContent = `
<p>Blocky Editor is an editor which supports the concept of blocks. It can help you to build an editor like Notion. It's tiny, fast and extensible. You can extend it with blocks.</p>
<h2>Usage</h2>
<ul>
  <li>Click on the text to input content</li>
  <li>Type <code>/</code> to trigger command panel</li>
  <li>Type <code>@</code> to trigger mention panel</li>
  <li>Drag the handle to re-order the blocks</li>
</ul>
<h2>Why?</h2>
<p>
  The main goal of this project is to provide an editor which is small and fast enough to be embedded in Notion-like apps.
</p>
<p>
  It doesn't depend on any heavy editor framework, and it handles the complex text-editing details for you.
</p>
<p>
  The developers only need to develop their blocks with their favourite UI frameworks.
</p>
<h2>Features</h2>
<ul>
  <li>Extremely small.</li>
  <li>Extensible. Extend the editor with custom blocks and spans.</li>
  <li>Static typed.</li>
  <li>Collaborative editing.</li>
</ul>
<h2>Packages</h2>
<p>
  <img src="/arch.png" />
</p>
<ul>
  <li>
    Core: The core of the editor. Written in vanilla JS. It can be used standalone without any 
    UI frameworks.
    <ul>
      <li>Gzipped size: ~40kb</li>
    </ul>
  </li>
  <li>
    React bindings: Wrap the editor in <a href="https://react.dev/">React</a>. Provide the UI facilities such as toolbar and spanner.
    <ul>
      <li>Gzipped size(including Core): ~48kb</li>
    </ul>
  </li>
  <li>
    Example(this page): The example to demonstrate how to use the editor.
  </li>
</ul>
<h2>Resources</h2>
<ul>
  <li><a href="https://blocky-editor.dev/doc/get-started">Get started</a></li>
  <li><a href="https://github.com/vincentdchan/blocky-editor/blob/master/CONTRIBUTING.md">CONTRIBUTING</a></li>
</ul>
<h2>Compatibility</h2>
<p>Tested on</p>
<ul>
  <li>Google Chrome</li>
  <li>Microsoft Edge</li>
  <li>Safari</li>
</ul>
`;
