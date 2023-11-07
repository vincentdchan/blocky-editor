import LogoImg from "./logo.png";
import DarkLogoImg from "./logo-dark.png";
import { Theme } from "@pkg/themeSwitch";

function AppLogo() {
  return (
    <Theme.Consumer>
      {(options: any) => (
        <img className="logo" src={options.darkMode ? DarkLogoImg : LogoImg} />
      )}
    </Theme.Consumer>
  );
}

export default AppLogo;
