"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  memo,
} from "react";
import { CiLight, CiDark } from "react-icons/ci";
import styles from "./themeSwitch.module.scss";

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

const ThemeSwitch = memo(() => {
  const theme = useContext(Theme);
  return (
    <div
      className={styles.container + (theme.darkMode ? " dark" : "")}
      onClick={(e) => {
        e.preventDefault();
        theme.toggle();
      }}
    >
      {theme.darkMode ? <CiDark /> : <CiLight />}
    </div>
  );
});

ThemeSwitch.displayName = "ThemeSwitch";

export { ThemeSwitch };
