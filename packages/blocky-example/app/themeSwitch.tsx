"use client";

import React, { Component, createContext } from "react";

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

interface ThemeProviderState {
  darkMode: boolean;
}

export class ThemeProvider extends Component<
  ThemeProviderProps,
  ThemeProviderState
> {
  constructor(props: ThemeProviderProps) {
    super(props);
    this.state = {
      darkMode: false,
    };
  }

  override componentDidUpdate(
    prevProps: unknown,
    prevState: ThemeProviderState
  ) {
    if (!prevState.darkMode && this.state.darkMode) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
  }

  #toggle = () => {
    this.setState({
      darkMode: !this.state.darkMode,
    });
  };

  render() {
    return (
      <Theme.Provider
        value={{ darkMode: this.state.darkMode, toggle: this.#toggle }}
      >
        {this.props.children}
      </Theme.Provider>
    );
  }
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
