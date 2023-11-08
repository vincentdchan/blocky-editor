import { Component } from "react";
import Markdown from "@pkg/components/markdown";
import { ThemeSwitch } from "@pkg/themeSwitch";
import { Link } from "react-router-dom";
import AppLogo from "@pkg/components/appLogo";
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

interface DocumentationState {
  selectedContent: string;
}

export interface DocumentationProps {
  items: DocItem[];
  content: DocItem;
}

class Documentation extends Component<DocumentationProps, DocumentationState> {
  constructor(props: DocumentationProps) {
    super(props);
  }

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
  renderSidebar() {
    return (
      <div className="sidebar">
        <Link to="/">
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
        {this.props.items.map((item, index) => (
          <div className="page-item" key={index.toString()}>
            <Link to={item.href} className="sidebar-item">
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
                  to={h.href}
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
  }

  render() {
    return (
      <div className="blocky-documentations">
        {this.renderSidebar()}
        <div className="main-content">
          <div className="md-content">
            <Markdown
              className="md-container"
              markdown={this.props.content.content}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default Documentation;
