# Builtin plugins

## Text block

Text block is built in. It's the most important block in the BlockyEditor. You don't need to do anything to load it.

It handles the basic text rendering and editing stuff.

Data definitions:

```typescript
interface TextBlockAttributes {
  textType: TextType;
  checked?: boolean /** used for checkbox */;
}
```

Builtin types:

- Checkbox
- Numbered
- Bulleted
- Normal
- Heading1
- Heading2
- Heading3
