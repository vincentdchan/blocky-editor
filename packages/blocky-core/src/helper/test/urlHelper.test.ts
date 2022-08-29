import { Delta } from "blocky-data";
import { test, expect, describe } from "vitest";
import { textToDeltaWithURL } from "../urlHelper";

describe("textToDeltaWithURL", () => {
  test("pure url", () => {
    const delta = textToDeltaWithURL(
      "https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url"
    );
    expect(delta).toEqual(
      new Delta().insert(
        "https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url",
        {
          href: "https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url",
        }
      )
    );
  });

  test("prefix", () => {
    const delta = textToDeltaWithURL(
      "Hello https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url"
    );
    expect(delta).toEqual(
      new Delta()
        .insert("Hello ")
        .insert(
          "https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url",
          {
            href: "https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url",
          }
        )
    );
  });

  test("suffix", () => {
    const delta = textToDeltaWithURL(
      "https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url World"
    );
    expect(delta).toEqual(
      new Delta()
        .insert(
          "https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url",
          {
            href: "https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url",
          }
        )
        .insert(" World")
    );
  });
  test("multiples", () => {
    const delta = textToDeltaWithURL(
      "1. https://playcode.io/javascript/ 2. https://playcode.io/javascript/ End"
    );
    expect(delta).toEqual(
      new Delta()
        .insert("1. ")
        .insert("https://playcode.io/javascript/", {
          href: "https://playcode.io/javascript/",
        })
        .insert(" 2. ")
        .insert("https://playcode.io/javascript/", {
          href: "https://playcode.io/javascript/",
        })
        .insert(" End")
    );
  });
});
