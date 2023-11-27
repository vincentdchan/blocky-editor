"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import Sidebar from "@pkg/components/sidebar";
import "blocky-core/css/blocky-core.css";
import { ThemeProvider } from "../themeSwitch";
import Navbar from "@pkg/components/navbar";

const LoroExample = lazy(() => import("./loroExample"));

function NoTitlePage() {
  const [isClient, setIsCient] = useState(false);
  useEffect(() => {
    setIsCient(true);
  }, []);
  return (
    <ThemeProvider>
      <div className="blocky-example-app-window">
        <Navbar />
        <div className="blocky-example-app-body">
          <Sidebar />
          <div className="blocky-example-container">
            {isClient && (
              <Suspense>
                <LoroExample />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default NoTitlePage;
