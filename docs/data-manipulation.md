
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
editor.state // get access to the state. 
controller.state  // get state from the controller
```

### Update the state

Changes applied to the state will not update the UI. So you must wrap the changing operations in a function:

```typescript
editor.update(() => {
  // Modify the state
});
```

When the operations are finished, the editor will automatically update the UI.

### Serialization

If you want to dump the document tree to JSON, you can use the utility in `serialize` namespace.

```typescript
import { serialize } from "blocky-core";

console.log(editor.state);
```

## Data representation

The data model in Blocky Editor is represented as an XML Document:

Example:

```xml
<document>
  <block blockName="text">
    <Text />
  </block>
  <block blockName="text">
    <Text />
    <block-children>
      <block blockName="text">
        <Text />
      </block>
    </block-children>
  </block>
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

  setAttribute(name: string, value: string);
  getAttribute(name: string): string | undefined;
  insertAfter(node: BlockyNode, after?: BlockyNode);
  appendChild(node: BlockyNode);
  removeChild(node: BlockyNode);

}
```

### BlockyTextModel

`BlockyTextModel` is a kind of `BlockyNode`, which
is used to store text.

`BlockyTextModel` is a leaf in the document tree.
It doesn't have children.

```typescript
export class BlockyTextModel implements BlockyNode {

  insert(index: number, text: string, attributes?: AttributesObject);
  format(index: number, length: number, attributes?: AttributesObject);
  delete(index: number, length: number);

}
```
