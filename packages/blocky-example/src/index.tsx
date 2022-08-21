import { render, Component } from "preact";
import Router, { route } from "preact-router";
import App from "./app";
import Documentation, { type DocItem, type Heading } from "./documentations";
import GetStartedDoc from "./docs/get-started.md?raw";
import DataManiDoc from "./docs/data-manipulation.md?raw";
import WriteBlockDoc from "./docs/how-to-write-a-block.md?raw";
import FollowerWidgetDoc from "./docs/follower-widget.md?raw";

const appId = "blocky-example-app";

function makeHeadingsByContent(href: string, content: string): Heading[] {
  const reg = /##([^\n#]+)/g;
  let titleTest = reg.exec(content);
  const result: Heading[] = [];

  while (titleTest) {
    const title = titleTest[1].trim();
    const suffix = title
      .split(" ")
      .map((s) => s.toLowerCase())
      .join("-");
    result.push({
      title,
      href: href + "#" + suffix,
      id: suffix,
    });

    titleTest = reg.exec(content);
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
  makeDocItem("/doc/data-manipulation", DataManiDoc),
  makeDocItem("/doc/how-to-write-a-block", WriteBlockDoc),
  makeDocItem("/doc/follower-widget", FollowerWidgetDoc),
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
    <Documentation
      path="/doc/data-manipulation"
      items={docItems}
      content={docItems[1]}
    />
    <Documentation
      path="/doc/how-to-write-a-block"
      items={docItems}
      content={docItems[2]}
    />
    <Documentation
      path="/doc/follower-widget"
      items={docItems}
      content={docItems[3]}
    />
    <Redirect path="/doc" to="/doc/get-started" />
  </Router>,
  document.getElementById(appId)!
);
