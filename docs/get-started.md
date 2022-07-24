# Get started

## Install the editor

Install the editor with your favorite package manger:

```
npm install blocky-core
```

If you want to use the editor with Preact, install the `blocky-preact`:

```
npm install blocky-preact
```

## Create a controller:

A controller is used to initialize and control the editor.
You can choose what plugins you want the editor to load.
You can define how the editor render the toolbar.

```tsx
import { EditorController } from "blocky-core";
import { makePreactBanner, makePreactToolbar } from "blocky-preact";
import BannerMenu from "./bannerMenu";
import ToolbarMenu from "./toolbarMenu";

/**
 * The controller is used to control the editor.
 */
function makeController(): EditorController {
  return new EditorController({
    /**
     * Define the plugins to implement customize features.
     */
    plugins: [
      makeBoldedTextPlugin(),
      makeBulletListPlugin(),
      makeImageBlockPlugin(),
    ],
    /**
     * Tell the editor how to render the banner.
     * We use a banner written in Preact here.
     */
    bannerFactory: makePreactBanner((editorController: EditorController) => (
      <BannerMenu editorController={editorController} />
    )),
    /**
     * Tell the editor how to render the banner.
     * We use a toolbar written in Preact here.
     */
    toolbarFactory: makePreactToolbar((editorController: EditorController) => {
      return <ToolbarMenu editorController={editorController} />;
    }),
  });
}
```

## Initialize the editor

### Preact

Pass the editor to the component.

```tsx
import { EditorController } from "blocky-core";

class App extends Component {
  private editorController: EditorController;

  constructor(props: {}) {
    super(props);
    this.editorController = makeController();
  }

  render() {
    return <BlockyEditor controller={this.editorController} />;
  }
}
```

### VanillaJS

```typescript
import { Editor } from "blocky-core";

const container = document.querySelector("#app");
const editor = Editor.fromController(container, controller);
editor.render();
```

## Collaborative editing

Blocky editor can be edited collaboratively through [yjs](https://github.com/yjs/yjs).

You can simply enable collaborative editing through the yjs plugin.

### Install the plugin

```shell
npm install --save blocky-yjs
```

### Use the plugin

Create pass the doc to the plugin:

```tsx
import * as Y from "yjs";
import { makeYjsPlugin } from "blocky-yjs";

function makeController(doc: Y.Doc): EditorController {
  return new EditorController({
    collaborativeCursorOptions: {
      id: "User-1",
      idToName: (id: string) => id,
      idToColor: () => "orange",
    },
    /**
     * Define the plugins to implement customize features.
     */
    plugins: [
      makeYjsPlugin({
        doc,
        allowInit,
      }),
      // ...
    ],
    // ...
  });
}

const doc = new Y.Doc();
const controller = makeController(doc);
```
