import { Component } from "preact";
import Markdown from "@pkg/components/markdown";
import { Link } from "preact-router/match";
import LogoImg from "./logo.png";
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
        <Link href="/">
          <img className="logo" src={LogoImg} />
        </Link>
        {this.props.items.map((item) => (
          <div className="page-item">
            <Link href={item.href} className="sidebar-item">
              {item.name}
            </Link>
            <div className="headings">
              {item.headings.map((h) => (
                <Link
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
  }
  render() {
    return (
      <div className="blocky-documentations">
        {this.renderSidebar()}
        <div className="main-content">
          <div className="md-content">
            <Markdown markdown={this.props.content.content} />
          </div>
        </div>
      </div>
    );
  }
}

export default Documentation;
