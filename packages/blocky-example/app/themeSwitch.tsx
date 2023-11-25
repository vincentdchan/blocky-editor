"use client";

import React, { createContext, useEffect, useState } from "react";

export interface ThemeContext {
  darkMode: boolean;
  toggle: () => void;
}

export const Theme = createContext<ThemeContext>({
  darkMode: false,
  toggle: () => undefined,
});

export interface ThemeProviderProps {
  children?: React.ReactNode;
}

export const blockyExampleFont = `Inter, system-ui, -apple-system, BlinkMacSystemFont, Roboto, 'Open Sans', 'Helvetica Neue', sans-serif`;

export function ThemeProvider(props: ThemeProviderProps) {
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--blocky-example-font",
      blockyExampleFont
    );

    return () => {
      document.documentElement.style.removeProperty("--blocky-example-font");
    };
  }, []);

  const toggle = () => {
    setDarkMode(!darkMode);
  };

  return (
    <Theme.Provider value={{ darkMode, toggle }}>
      {props.children}
    </Theme.Provider>
  );
}

export function ThemeSwitch() {
  return (
    <Theme.Consumer>
      {(theme) => (
        <div className="theme-switch-wrapper">
          <label className="theme-switch">
            <input
              type="checkbox"
              id="checkbox"
              checked={theme.darkMode}
              onChange={() => theme.toggle()}
            />
            <div className="slider round"></div>
          </label>
          <p>Enable Dark Mode</p>
        </div>
      )}
    </Theme.Consumer>
  );
}
