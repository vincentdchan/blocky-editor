import { describe, expect, it } from "vitest";
import { TextBlock } from "./textBlock";
import { HTMLConverter } from "@pkg/helper/htmlConverter";
import { makeDefaultIdGenerator } from "@pkg/helper/idHelper";
import { type BlockDataElement, EditorController } from "..";

function parseHTML(content: string): BlockDataElement {
  const idGenerator = makeDefaultIdGenerator();
  const htmlConverter = new HTMLConverter({
    idGenerator,
  });
  const editorController = new EditorController("user");

  const container = document.createElement("div");
  container.innerHTML = content;

  const data = TextBlock.getTextElementFromDOM(
    editorController,
    container.firstChild as HTMLElement,
    htmlConverter
  );
  return data;
}

describe("TextBlock", () => {
  it("define", () => {
    expect(TextBlock.Name).toBe("Text");
  });

  it("paste", () => {
    const data = parseHTML("<p>hello</p>");

    expect(data.t).equals("Text");

    const textContent = data.getTextModel("textContent");
    expect(textContent?.delta.ops).deep.equals([
      {
        insert: "hello",
      },
    ]);
  });

  it("paste code", () => {
    const data = parseHTML("<p>hello <code>world</code></p>");

    expect(data.t).equals("Text");

    const textContent = data.getTextModel("textContent");
    expect(textContent?.delta.ops).deep.equals([
      {
        insert: "hello ",
      },
      {
        insert: "world",
        attributes: {
          code: true,
        },
      },
    ]);
  });

  it("paste bold", () => {
    const data = parseHTML("<p>hello <b>world</b></p>");

    expect(data.t).equals("Text");

    const textContent = data.getTextModel("textContent");
    expect(textContent?.delta.ops).deep.equals([
      {
        insert: "hello ",
      },
      {
        insert: "world",
        attributes: {
          bold: true,
        },
      },
    ]);
  });

  it("paste italic", () => {
    const data = parseHTML("<p>hello <i>world</i></p>");

    expect(data.t).equals("Text");

    const textContent = data.getTextModel("textContent");
    expect(textContent?.delta.ops).deep.equals([
      {
        insert: "hello ",
      },
      {
        insert: "world",
        attributes: {
          italic: true,
        },
      },
    ]);
  });
});
