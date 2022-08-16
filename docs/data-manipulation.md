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

- **updateAttributes(node, attributes):** Update the attributes of a `BlockyNode`.
- **appendChild(node, child):** Append a node at the end
  of another node.
- **setCursorState(cursorState):** Set the cursor after
  the changeset is applied.
- **removeNode(node):** Remove a node from the parent.
- **deleteChildrenAt(parent, index, count):** Delete
  a sequences of children of a node.
- **insertChildrenAfter(parent, children, after):** Insert a sequences of children after another node.
- **insertChildrenAt(parent, index, children):** Insert
  children at the position of a node.
- **textEdit(node, propName, delta):** Apply the quill
  delta to the BlockyNode. For a `Text` block, the `propName` is usually called `textContent`.
- **push(operation):** Push an operation to the changeset.
  Usually you don't need this method. Use
  the methods above
- **apply():** Apply this changeset to the `EditorState`.
  The editor will render automatically after the changeset is applied.

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
    <Title />
  </head>
  <body>
    <Text />
    <Text />
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

You can the the `compose` method to submit changes. For example:

```typescript
changeset.textEdit(textNode, () => new Delta().insert("Hello world")).apply();
changeset.textEdit(textNode, () => new Delta().retain(4).delete(1)).apply(); // delete 1 char at the index 4
```

## Collaborative editing

The document tree of BlockyEditor supports collaborative editing naturally.
What you need is to transfer the changeset betweens users.
Changeset can be applied repeatedly. But they must be applied in order.

Example:

```typescript
this.editorControllerLeft.state.changesetApplied.on((changeset) => {
  // simulate the net work
  setTimeout(() => {
    this.editorControllerRight.state.apply({
      ...changeset,
      afterCursor: undefined,
      options: {
        ...changeset.options,
        updateView: true,
      },
    });
  });
});

this.editorControllerRight.state.changesetApplied.on((changeset) => {
  setTimeout(() => {
    this.editorControllerLeft.state.apply({
      ...changeset,
      afterCursor: undefined,
      options: {
        ...changeset.options,
        updateView: true,
      },
    });
  });
});
```
