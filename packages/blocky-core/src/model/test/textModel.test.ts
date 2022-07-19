// import { BlockyTextModel, type TextSlice } from "@pkg/model/tree";
import { test, expect } from "vitest";

test("text", () => {});

// function modelToSpans(model: BlockyTextModel): string[] {
//   const textSpans: string[] = [];

//   let ptr = model.textBegin;
//   while (ptr) {
//     textSpans.push(ptr.content);
//     ptr = ptr.nextSibling;
//   }

//   return textSpans;
// }

// function modelToStyles(model: BlockyTextModel): any[] {
//   const textSpans: any[] = [];

//   let ptr = model.textBegin;
//   while (ptr) {
//     textSpans.push(ptr.attributes);
//     ptr = ptr.nextSibling;
//   }

//   return textSpans;
// }

// test("textModel init", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "Hello world");
//   expect(text.length).toBe("Hello world".length);
// });

// test("textModel delete", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "Hello world");
// });

// test("textModel delete all", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "Hello world");
//   text.delete(0, "Hello world".length);
//   expect(text.length).toBe(0);
//   expect(text.toString()).toBe("");
// });

// test("textModel format #1", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "This is bolded text");
//   text.format(8, 6, {
//     bold: true,
//   });

//   const textSpans: string[] = modelToSpans(text);
//   const styles = modelToStyles(text);
//   expect(styles[0]).toBeUndefined();
//   expect(styles[2]).toBeUndefined();

//   expect(textSpans).toEqual(["This is ", "bolded", " text"]);
// });

// test("textModel format #2", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "This is bolded text");
//   text.format(8, 6, {
//     bold: true,
//   });

//   text.format(5, 2, {
//     bold: true,
//   });

//   expect(text.toString()).toEqual("This is bolded text");
// });

// test("textModel delete node #1", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "This is bolded text");
//   text.format(8, 6, {
//     bold: true,
//   });

//   text.delete(8, 4);

//   const textSpans: string[] = modelToSpans(text);

//   expect(textSpans).toEqual(["This is ", "ed", " text"]);
// });

// test("textModel delete node #2", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "This is bolded text");
//   text.format(8, 6, {
//     bold: true,
//   });

//   text.delete(12, 4);

//   const textSpans: string[] = modelToSpans(text);

//   expect(textSpans).toEqual(["This is ", "bold", "ext"]);
// });

// test("textModel delete node #3", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "This is bolded text");
//   text.format(8, 6, {
//     bold: true,
//   });

//   text.delete(8, 7);

//   const textSpans: string[] = modelToSpans(text);
//   const styles: any[] = modelToStyles(text);

//   expect(textSpans).toEqual(["This is text"]);
//   expect(styles[0]).toBeUndefined();
// });

// test("textModel slice", () => {
//   const text = new BlockyTextModel();
//   text.insert(0, "This is bolded text");
//   text.format(8, 6, {
//     bold: true,
//   });
//   const slices = text.slice(5);
//   expect(slices).toEqual([
//     { content: "is ", attributes: undefined },
//     { content: "bolded", attributes: { bold: true } },
//     { content: " text", attributes: undefined },
//   ]);
// });

// test("textModel insert #1", () => {
//   const slices: TextSlice[] = [
//     { content: "is ", attributes: undefined },
//     { content: "bolded", attributes: { bold: true } },
//     { content: " text", attributes: undefined },
//   ];

//   const textModel = new BlockyTextModel();

//   let ptr = 0;
//   for (const slice of slices) {
//     textModel.insert(ptr, slice.content, slice.attributes);
//     ptr += slice.content.length;
//   }

//   expect(textModel.toString()).toEqual("is bolded text");
// });

// test("textModel insert #2", () => {
//   const slices: TextSlice[] = [
//     { content: "is ", attributes: undefined },
//     { content: "bolded", attributes: { bold: true } },
//     { content: " text", attributes: undefined },
//   ];

//   const textModel = new BlockyTextModel();

//   let ptr = 0;
//   for (const slice of slices) {
//     textModel.insert(ptr, slice.content, slice.attributes);
//     ptr += slice.content.length;
//   }

//   let idx = 10;
//   textModel.insert(idx, "# ");
//   idx += 2;
//   textModel.insert(idx, "B ", { bold: true });
//   expect(textModel.toString()).toEqual("is bolded # B text");
// });

// test("textModel insert #3", () => {
//   const slices: TextSlice[] = [
//     { content: "is ", attributes: undefined },
//     { content: "bolded", attributes: { bold: true } },
//     { content: " text", attributes: undefined },
//   ];

//   const textModel = new BlockyTextModel();

//   let ptr = 0;
//   for (const slice of slices) {
//     textModel.insert(ptr, slice.content, slice.attributes);
//     ptr += slice.content.length;
//   }

//   ptr = textModel.length;
//   textModel.insert(ptr, "#1");
//   ptr += 2;
//   textModel.insert(ptr, "#2", { bold: true });
//   ptr += 2;
//   textModel.insert(ptr, "#3");
//   expect(textModel.toString()).toEqual("is bolded text#1#2#3");
// });

// test("textModel insert #3", () => {
//   const textModel = new BlockyTextModel();

//   textModel.insert(0, "Hello World");
//   textModel.insert(0, "#");
//   expect(textModel.length).toEqual("Hello World".length + 1);
//   expect(textModel.toString()).toEqual("#Hello World");
// });

// test("textModel insert at end", () => {
//   const textModel = new BlockyTextModel();

//   textModel.insert(0, "Hello ");
//   textModel.insert(textModel.length, "World");
//   expect(textModel.toString(), "Hello World");
// });
