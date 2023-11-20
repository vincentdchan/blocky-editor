"use client";
import React, { useEffect, useState, Suspense, lazy } from "react";
import Sidebar from "@pkg/components/sidebar";
import { ThemeProvider } from "./themeSwitch";
import { ReadMeContent } from "./readme";
import Markdown from "@pkg/components/markdown";

const App = lazy(() => import("./app"));

function Page() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return (
    <ThemeProvider>
      <div className="blocky-example-app-window">
        <Sidebar />
        <div className="blocky-example-container">
          {isClient ? (
            <Suspense>
              <App initContent={ReadMeContent} />
            </Suspense>
          ) : (
            <div className="blocky-seo">
              <Markdown markdown={ReadMeContent} />
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

export default Page;
