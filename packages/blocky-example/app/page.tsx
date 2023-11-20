"use client";
import React, { useEffect, useState, Suspense, lazy } from "react";
import Sidebar from "@pkg/components/sidebar";

const App = lazy(() => import("./app"));

function Page() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return (
    <div className="blocky-example-app-window">
      <Sidebar />
      {isClient ? (
        <Suspense>
          <App />
        </Suspense>
      ) : (
        <div className="blocky-example-app-loading" />
      )}
    </div>
  );
}

export default Page;
