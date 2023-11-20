"use client";
import Markdown from "@pkg/components/markdown";
import { ThemeProvider, ThemeSwitch } from "@pkg/app/themeSwitch";
import Link from "next/link";
import Navbar from "../navbar";
import styles from "./documentation.module.scss";

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
  const renderSidebar = () => {
    return (
      <div className={styles.sidebar}>
        {props.items.map((item, index) => (
          <div className={styles.pageItem} key={index.toString()}>
            <Link href={item.href} className={styles.sidebarItem}>
              {item.name}
            </Link>
            <div className={styles.headings}>
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
                  className={styles.sidebarItem}
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
    <ThemeProvider>
      <div className={styles.navbarContainer}>
        <Navbar />
      </div>
      <div className={styles.documentations}>
        {renderSidebar()}
        <div className={styles.mainContent}>
          <div className="md-content">
            <Markdown
              className="md-container"
              markdown={props.content.content}
            />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default Documentation;
