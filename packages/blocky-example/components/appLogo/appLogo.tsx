"use client";

import React from "react";
import LogoImg from "./logo.png";
import DarkLogoImg from "./logo-dark.png";
import { Theme } from "@pkg/app/themeSwitch";
import Image from "next/image";

export interface AppLogoProps {
  style?: React.CSSProperties;
}

function AppLogo(props: AppLogoProps) {
  return (
    <Theme.Consumer>
      {(options: any) => (
        <Image
          className="logo"
          src={options.darkMode ? DarkLogoImg : LogoImg}
          alt="logo"
          sizes="100vw"
          // Make the image display full width
          style={
            props.style ?? {
              width: "100%",
              height: "auto",
            }
          }
        />
      )}
    </Theme.Consumer>
  );
}

export default AppLogo;
