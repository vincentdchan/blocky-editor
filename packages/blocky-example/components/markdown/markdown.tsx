"use client";
import { useMemo } from "react";
import * as marked from "marked";
import hljs from "highlight.js";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/github.css";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);

export interface MarkdownProps {
  markdown: string;
  baseUrl?: string;
  className?: string;
}

marked.marked.setOptions({
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : "plaintext";
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: "hljs language-",
});

function Markdown(props: MarkdownProps) {
  const htmlContent = useMemo(() => {
    const htmlContent = marked.marked(props.markdown, {
      baseUrl: props.baseUrl,
    });
    return htmlContent;
  }, [props.baseUrl, props.markdown]);

  return (
    <div
      className={props.className}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    ></div>
  );
}

export default Markdown;
