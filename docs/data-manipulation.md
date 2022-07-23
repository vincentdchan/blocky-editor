# Data manipulation

## State

The state of the editor includes:

- Cursor
- [The document tree.](#data-representation)
- The blocks instances.

### API

The state instance can be accessed from the editor and the controller.

For example:

```typescript
editor.state; // get access to the state.
controller.state; // get state from the controller
```

### Construct the state

**Empty State:**

To create a controller with empty state:

```typescript
const controller = EditorController.emptyState();
```

**Default state:**

```typescript
const controller = new EditorController();
```

### Update the state

The document tree is read-only. It should be regarded as immutable tree.

If you want to mutate the tree, you need to apply changeset
to the state.

For example:

```typescript
new Changeset(this.editor.state).appendChild(container, child).apply(); // append child
new Changeset(this.editor.state).removeChild(container, child).apply(); // remove child
```

When apply is called, the changeset will be applied to the editor.
At the same time, the changeset will be logged and transmitted.

### Serialization

If you want to dump the document tree to JSON, you can use the utility in `serialize` namespace.

```typescript
import { serialize } from "blocky-core";

console.log(serialize.serializeState(editor.state));
```

## Data representation

The data model in Blocky Editor is represented as an XML Document:

Example:

```xml
<document>
  <head>
    <title>
      <blocky-text/>
    </title>
  </head>
  <body>
    <Text>
      <blocky-text/>
    </Text>
    <Text>
      <blocky-text />
      <Image src="" />
    </Text>
  </body>
</document>
```

### BlockyNode

The tree of the document is assembled with `BlockyNode`.

Every node has a nodeName corresponding to the nodeName in XML.

### BlockyElement

`BlockyElement` is a kind of `BlockyNode`,
which can store attributes:

```typescript
class BlockyElement implements BlockyNode {
  getAttribute(name: string): string | undefined;
  firstChild: BlockyNode | null;
  lastChild: BlockyNode | null;
  childrenLength: number;
}
```

### BlockyTextModel

The text model of the blocky editor is implemented by [quill-delta](https://github.com/quilljs/delta).

```typescript
export class BlockyTextModel implements BlockyNode {
  get delta(): Delta;
}
```

You can the the `compose` method to submit changeds. For example:

```typescript
changeset.textEdit(() => new Delta().insert("Hello world")).apply();
changeset.textEdit(() => new Delta().retain(4).delete(1)).apply(); // delete 1 char at the index 4
```

## Collaborative editing

The document tree of BlockyNode corresponds to the XMLElement in [Yjs](https://github.com/yjs/yjs).

All the changes committed to the document will be synced to the Yjs's doc automatically.

If you don't want to use yjs, it's not hard to adapt the BlockyNode model to other syncing models such as OT or [automerge](https://github.com/automerge/automerge).
