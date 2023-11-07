import { Suspense, lazy, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Routes, Route, useNavigate, BrowserRouter } from "react-router-dom";
import App from "./app";
import type { DocItem, Heading } from "./documentations";
import GetStartedDoc from "./docs/get-started.md?raw";
import ApiDoc from "./docs/api.md?raw";
import FaqDoc from "./docs/faq.md?raw";
import BuiltinPluginsDoc from "./docs/builtin-plugins.md?raw";
import { ThemeProvider } from "./themeSwitch";

const Documentation = lazy(() => import("./documentations"));

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

function Redirect(props: RedirectProps) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(props.to)
  }, [props.to, navigate]);
  return null;
}

const root = createRoot(document.getElementById(appId)!);

root.render(
  <ThemeProvider>
    <Suspense fallback={null}>
      <BrowserRouter>
        <Routes>
          <Route
          path="/"
          element={<App />}
          />
          <Route
            path="/doc/get-started"
            element={
              <Documentation items={docItems}
                content={docItems[0]}
              />
            }
          />
          <Route
            path="/doc/api" 
            element={
              <Documentation items={docItems} content={docItems[1]} />
            }
          />
          <Route
            path="/doc/builtin-plugins"
            element={
              <Documentation
                items={docItems}
                content={docItems[2]}
              />
            }
          />
          <Route
            path="/doc/faq"
            element={
              <Documentation
                items={docItems}
                content={docItems[3]}
              />
            }
          />
          <Route
            path="/doc"
            element={
              <Redirect to="/doc/get-started" />
            }
          />
        </Routes>
      </BrowserRouter>
    </Suspense>
  </ThemeProvider>,
);
