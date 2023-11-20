import styles from "./navbar.module.scss";
import Link from "next/link";
import AppLogo from "@pkg/components/appLogo";
import { ThemeSwitch } from "@pkg/app/themeSwitch";

function Navbar() {
  return (
    <header className={styles.container}>
      <div
        className={styles.brand}
        style={
          {
            ["--brand-height"]: "32px",
          } as any
        }
      >
        <Link href="/">
          <AppLogo
            style={{
              width: "auto",
              height: "var(--brand-height)",
            }}
          />
        </Link>
      </div>
      <div className={styles.rightPart}>
        <ThemeSwitch />
        <a href="https://github.com/vincentdchan/blocky-editor" target="_blank">
          <img
            alt="GitHub Repo stars"
            src="https://img.shields.io/github/stars/vincentdchan/blocky-editor?style=social"
          />
        </a>
        <a href="https://twitter.com/cdz_solo" target="_blank">
          <img
            alt="Twitter Follow"
            src="https://img.shields.io/twitter/follow/cdz_solo?style=social"
          ></img>
        </a>
      </div>
    </header>
  );
}

export default Navbar;
