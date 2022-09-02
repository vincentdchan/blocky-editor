import { Component, ComponentChildren, createContext } from "preact";

export interface ThemeContext {
  darkMode: boolean;
  toggle: () => void;
}

export const Theme = createContext<ThemeContext>({
  darkMode: false,
  toggle: () => undefined,
});

export interface ThemeProviderProps {
  children?: ComponentChildren;
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

  render(props: ThemeProviderProps) {
    return (
      <Theme.Provider
        value={{ darkMode: this.state.darkMode, toggle: this.#toggle }}
      >
        {props.children}
      </Theme.Provider>
    );
  }
}

export class ThemeSwitch extends Component {
  render() {
    return (
      <Theme.Consumer>
        {(theme) => (
          <div class="theme-switch-wrapper">
            <label class="theme-switch" for="checkbox">
              <input
                type="checkbox"
                id="checkbox"
                checked={theme.darkMode}
                onChange={() => theme.toggle()}
              />
              <div class="slider round"></div>
            </label>
            <p>Enable Dark Mode</p>
          </div>
        )}
      </Theme.Consumer>
    );
  }
}
