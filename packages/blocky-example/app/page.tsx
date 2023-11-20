"use client";
import React, { useEffect, useState, Suspense, lazy } from "react";
import Sidebar from "@pkg/components/sidebar";
import { ThemeProvider } from "./themeSwitch";

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
              <App />
            </Suspense>
          ) : (
            <div className="blocky-example-app-loading" />
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

export default Page;
