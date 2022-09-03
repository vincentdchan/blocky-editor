## 2.12.0

- New embed API
- Use hook style for `DefaultBlockOutline`
- Fix #61: dispose() wasn't call when the block is deleted directly

## 2.11.0

- Add `EditorController` to the props of the renderer in `blocky-preact`
- Add `max-width` to the content of the body

## 2.10.0

- Use `IEditorStateInitOptions` to initialize `EditorState`
- Recognize hyperlinks from pasted text
- Fix some issues

## 2.9.1

- Fix issue of empty placeholder
- Introduce API `emptyPlaceholder` to the controller's options
- Export `BlockRegistry`, `EmbedRegistry` and `SpanRegistry`

## 2.9.0

- Export `Delta` from `blocky-data`
- Export `Embed` plugins
- Shrink the size to 28kb(minified + gzipped)
- Fix some issues

## 2.8.0

- Add `EditorController.applyDeltaAtCursor()` API
- Introduce `EmbedRegistry` to the editor(alpha)
- Fix some issues

## 2.7.0
