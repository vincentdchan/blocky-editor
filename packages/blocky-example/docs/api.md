# API

## EditorState

The state of the editor includes:

- The state of the cursor and selection
- [The document tree](./get-started#data-representation)
- The blocks instances

### Construct the state

**Empty State:**

To create a controller with empty state:

```typescript
const controller = EditorController.emptyState();
```

By default, you don't need to create the `EditorState` yourself unless you want to use the state without the editor(Such as running on a server).

**Default state:**

The controller will create an `EditorState` for you.

```typescript
const controller = new EditorController();
```

### Access the state

The state instance can be accessed from the editor and the controller.

For example:

```typescript
editor.state; // get access to the state.
controller.state; // get state from the controller
```

### Update the state

There are two ways to update the state.
The `EditorController` provides the high-level API.
The `Changeset` provides the low-level API.

## Serialization

If you want to dump the document tree to JSON, you can use the utility in `serialize` namespace.

```typescript
import { serialize } from "blocky-core";

console.log(serialize.serializeState(editor.state));
```

## EditorController

- **insertBlockAfterId(element, afterId, options):** Insert a block in a element after id.
- **formatTextOnSelectedText(attributes):** Format the text in the selection.
- **pasteHTMLAtCursor(htmlString):** Paste HTML string from the clipboard.
- **deleteBlock(id):** Delete the block by id.
- **setCursorState(cursorState):** Set the cursor state of the editor.
- **getBlockElementAtCursor:** Return the element the cursor pointing at.
- **insertFollowerWidget(widget):** Insert the widget following the cursor.

## Changeset

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

The methods of `Changeset`:

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

## BlockyNode

The tree of the document is assembled with `BlockyNode`.

Every node has a nodeName corresponding to the nodeName in XML.

## BlockyElement

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

## BlockyTextModel

The text model of the blocky editor is implemented by [quill-delta](https://github.com/quilljs/delta).

```typescript
export class BlockyTextModel implements BlockyNode {
  get delta(): Delta;
}
```

You can the the `compose` method to submit changes. For example:

```typescript
import { Delta } from "blocky-core";

changeset.textEdit(textNode, () => new Delta().insert("Hello world")).apply();
changeset.textEdit(textNode, () => new Delta().retain(4).delete(1)).apply(); // delete 1 char at the index 4
```

## Follower Widget

A follower widget can follow the cursor when the user is typing. You can implement features such as a command panel or autocomplete through the follower widget.

![](/follow-widget.gif)

When the widget is inserted, it will follow the cursor automatically until the user changes the cursor manually. If you want to unmount the widget, call the `dispose()`.

When the user begins to type, the content will be passed to the widget by the method `setEditingValue`. You can override this method to update your view.

As usual, there are two ways to implement a follower widget: using the raw API or using Preact.

### React

Use the method `makePreactFollowerWidget`.

```tsx
import { makeReactFollowerWidget } from "blocky-react";

editor.insertFollowerWidget(
  makeReactFollowerWidget(({ controller, editingValue, closeWidget }) => (
    <CommandPanel
      controller={controller}
      editingValue={editingValue}
      closeWidget={closeWidget}
    />
  ))
);
```

### VanillaJS

Extend the class `FollowerWidget`.

```typescript
import { type EditorController, FollowerWidget } from "blocky-core";

export class MyFollowWidget extends FollowerWidget {
  override setEditingValue(value: string) {
    this.editingValue = value;
    // implement here
  }
  override widgetMounted(controller: EditorController): void {
    super.widgetMounted(controller);
    // implement here
  }
  override dispose(): void {
    // implement here
    super.dispose();
  }
}

editor.insertFollowerWidget(new MyFollowWidget());
```
