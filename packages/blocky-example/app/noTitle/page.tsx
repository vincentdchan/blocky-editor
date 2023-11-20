"use client";

import { lazy, useState, useEffect, Suspense } from "react";
import Sidebar from "@pkg/components/sidebar";
import "@pkg/app/app.scss";
import "blocky-core/css/blocky-core.css";
import { ThemeProvider } from "../themeSwitch";

const NoTitleEditor = lazy(() => import("./noTitle"));

function NoTitlePage() {
  const [isClient, setIsCient] = useState(false);
  useEffect(() => {
    setIsCient(true);
  }, []);
  return (
    <ThemeProvider>
      <div className="blocky-example-app-window">
        <Sidebar />
        <div className="blocky-example-container">
          {isClient && (
            <Suspense>
              <NoTitleEditor />
            </Suspense>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
}

export default NoTitlePage;
