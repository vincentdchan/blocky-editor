# Follower Widget

A follower widget can follow the cursor when the user is typing. You can implement features such as a command panel or autocomplete through the follower widget.

As usual, there are two ways to implement a follower widget: using the raw API or using Preact.

## VanillaJS

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

## Preact

Use the method `makePreactFollowerWidget`.

```tsx
import { makePreactFollowerWidget } from "blocky-preact";

editor.insertFollowerWidget(
  makePreactFollowerWidget(({ controller, editingValue, closeWidget }) => (
    <CommandPanel
      controller={controller}
      editingValue={editingValue}
      closeWidget={closeWidget}
    />
  ))
);
```
