import fs from "node:fs";
import path from "node:path";
import Documentation, {
  DocItem,
  Heading,
} from "@pkg/components/documentations";
import { redirect } from "next/navigation";
import "@pkg/app/app.scss";

export interface SectionPageProps {
  params: { section: string };
}

function makeHeadingsByContent(href: string, content: string): Heading[] {
  const result: Heading[] = [];

  const lines = content.split("\n");
  for (const line of lines) {
    const reg = /^##([^\n#]+)/g;
    let titleTest = reg.exec(line);

    if (titleTest) {
      const title = titleTest[1].trim();
      const suffix = title
        .split(" ")
        .map((s) => s.toLowerCase().replaceAll(/\?/g, ""))
        .join("-");
      result.push({
        title,
        href: href + "#" + suffix,
        id: suffix,
      });

      titleTest = reg.exec(content);
    }
  }

  return result;
}

function makeDocItem(href: string, content: string): DocItem {
  const titleTest = /#([^\n]+)/.exec(content);
  let title = "";
  if (titleTest) {
    title = titleTest[1].trim();
  }
  return {
    href,
    name: title,
    content,
    headings: makeHeadingsByContent(href, content),
  };
}

const allowNames = ["get-started", "api", "builtin-plugins", "faq"];

async function SectionPage(props: SectionPageProps) {
  const { section } = props.params;

  const docItems: DocItem[] = [];
  for (const doc of allowNames) {
    const mdPath = path.resolve("docs", doc + ".md");
    const content = await fs.promises.readFile(mdPath, "utf-8");
    const href = "/doc/" + doc;
    docItems.push(makeDocItem(href, content));
  }

  const item = docItems.find((item) => item.href === "/doc/" + section);
  if (!item) {
    // redirect to 404
    redirect("/404");
  }

  return <Documentation items={docItems} content={item} />;
}

export default SectionPage;
