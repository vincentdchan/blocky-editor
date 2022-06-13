import { Component, type JSX } from "preact";
import "./menu.scss";

export interface MenuProps {
  style?: JSX.CSSProperties;
  children?: any;
}

export class Menu extends Component<MenuProps> {
  override render({ children, style }: MenuProps) {
    return (
      <div className="blocky-menu" style={style}>
        {children}
      </div>
    );
  }
}

export interface MenuItemProps {
  style?: JSX.CSSProperties;
  onClick?: () => void;
  children?: any;
}

export class MenuItem extends Component<MenuItemProps> {
  override render({ style, onClick, children }: MenuItemProps) {
    return (
      <div className="blocky-menu-item blocky-cm-noselect" onClick={onClick} style={style}>
        {children}
      </div>
    );
  }
}

export function Divider() {
  return (
    <div className="blocky-menu-divider"></div>
  )
}
