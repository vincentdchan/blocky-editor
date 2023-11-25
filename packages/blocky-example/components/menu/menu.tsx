import React, { Component } from "react";
import "./menu.scss";

export interface MenuProps {
  style?: React.CSSProperties;
  children?: any;
}

export class Menu extends Component<MenuProps> {
  override render() {
    const { children, style } = this.props;
    return (
      <div className="blocky-menu" style={style}>
        {children}
      </div>
    );
  }
}

export interface MenuItemProps {
  style?: React.CSSProperties;
  onClick?: () => void;
  children?: any;
}

export class MenuItem extends Component<MenuItemProps> {
  override render() {
    const { style, onClick, children } = this.props;
    return (
      <div
        className="blocky-menu-item blocky-cm-noselect"
        onClick={onClick}
        style={style}
      >
        {children}
      </div>
    );
  }
}

export function Divider() {
  return <div className="blocky-menu-divider"></div>;
}
