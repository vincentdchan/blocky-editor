"use client";
import Markdown from "@pkg/components/markdown";
import { ThemeSwitch } from "@pkg/app/themeSwitch";
import AppLogo from "@pkg/components/appLogo";
import Link from "next/link";
import "./documentation.scss";

export interface Heading {
  title: string;
  href: string;
  id: string;
}

export interface DocItem {
  href: string;
  name: string;
  content: string;
  headings: Heading[];
}

export interface DocumentationProps {
  items: DocItem[];
  content: DocItem;
}

function Documentation(props: DocumentationProps) {
  // override componentDidMount() {
  //   setTimeout(() => {
  //     const hash = window.location.hash;
  //     if (hash.length < 1) {
  //       return;
  //     }
  //     const element = document.querySelector(hash);
  //     if (element) {
  //       console.log(element);
  //       element.scrollIntoView({ behavior: "smooth" });
  //     }
  //   }, 10);
  // }
  const renderSidebar = () => {
    return (
      <div className="sidebar">
        <Link href="/">
          <AppLogo />
        </Link>
        <div className="badge-container">
          <a
            href="https://github.com/vincentdchan/blocky-editor"
            target="_blank"
          >
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
        <ThemeSwitch />
        {props.items.map((item, index) => (
          <div className="page-item" key={index.toString()}>
            <Link href={item.href} className="sidebar-item">
              {item.name}
            </Link>
            <div className="headings">
              {item.headings.map((h) => (
                <Link
                  key={h.id}
                  onClick={() => {
                    const elm = document.getElementById(h.id);
                    if (!elm) {
                      return;
                    }
                    elm.scrollIntoView({ behavior: "smooth" });
                  }}
                  href={h.href}
                  className="sidebar-item"
                >
                  {h.title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="blocky-documentations">
      {renderSidebar()}
      <div className="main-content">
        <div className="md-content">
          <Markdown className="md-container" markdown={props.content.content} />
        </div>
      </div>
    </div>
  );
}

export default Documentation;
