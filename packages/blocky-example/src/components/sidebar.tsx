import { memo } from "react";
import { ThemeSwitch } from "@pkg/themeSwitch";
import { Link } from "react-router-dom";
import AppLogo from "@pkg/components/appLogo";

const Sidebar = memo(() => {
  return (
    <div className="blocky-example-sidebar-container">
      <header>
        <Link to="/">
          <AppLogo />
        </Link>
        <div className="blocky-example-badge-container">
          <a
            href="https://github.com/vincentdchan/blocky-editor"
            target="_blank"
          >
            <img
              alt="GitHub Repo stars"
              src="https://img.shields.io/github/stars/vincentdchan/blocky-editor?style=social"
            />
          </a>
        </div>
        <div
          className="blocky-example-badge-container"
          style={{ marginTop: 8 }}
        >
          <a href="https://twitter.com/cdz_solo" target="_blank">
            <img
              alt="Twitter Follow"
              src="https://img.shields.io/twitter/follow/cdz_solo?style=social"
            ></img>
          </a>
        </div>
        <ThemeSwitch />
      </header>
      <div>
        <Link className="blocky-example-link" to="/doc/get-started">
          Get started
        </Link>
        <Link className="blocky-example-link" to="/doc/api">
          Api
        </Link>
        <Link className="blocky-example-link" to="/noTitle">
          Editor without title
        </Link>
      </div>
    </div>
  );
});

export default Sidebar;
