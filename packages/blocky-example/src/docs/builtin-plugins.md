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
- Bulleted
- Normal
- Heading1
- Heading2
- Heading3

## Styled text plugin

Add styles of bold/italic/underline.

```typescript
import makeStyledTextPlugin from "blocky-core/dist/plugins/styledTextPlugin";
```

## Headings plugin

Add styles of h1/h2/h3.

```typescript
import makeHeadingsPlugin from "blocky-core/dist/plugins/headingsPlugin";
```

## Bullet list plugin

Add commands of bullet list.

```typescript
import makeBulletListPlugin from "blocky-core/dist/plugins/bulletListPlugin";
```
