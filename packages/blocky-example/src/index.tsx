import { render, Component } from "preact";
import Router, { route } from "preact-router";
import App from "./app";
import Documentation, { type DocItem, type Heading } from "./documentations";
import GetStartedDoc from "./docs/get-started.md?raw";
import ApiDoc from "./docs/api.md?raw";
import FaqDoc from "./docs/faq.md?raw";
import BuiltinPluginsDoc from "./docs/builtin-plugins.md?raw";

const appId = "blocky-example-app";

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

const docItems: DocItem[] = [
  makeDocItem("/doc/get-started", GetStartedDoc),
  makeDocItem("/doc/api", ApiDoc),
  makeDocItem("/doc/builtin-plugins", BuiltinPluginsDoc),
  makeDocItem("/doc/faq", FaqDoc),
];

interface RedirectProps {
  to: string;
}

class Redirect extends Component<RedirectProps> {
  componentWillMount() {
    route(this.props.to, true);
  }

  render() {
    return null;
  }
}

render(
  <Router>
    <App path="/" />
    <Documentation
      path="/doc/get-started"
      items={docItems}
      content={docItems[0]}
    />
    <Documentation path="/doc/api" items={docItems} content={docItems[1]} />
    <Documentation
      path="/doc/builtin-plugins"
      items={docItems}
      content={docItems[2]}
    />
    <Documentation path="/doc/faq" items={docItems} content={docItems[3]} />
    <Redirect path="/doc" to="/doc/get-started" />
  </Router>,
  document.getElementById(appId)!
);
