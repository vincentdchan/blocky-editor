import { Component, createRef } from "preact";
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
});

class Markdown extends Component<MarkdownProps> {
  #ref = createRef<HTMLDivElement>();
  override componentDidMount() {
    const htmlContent = marked.marked(this.props.markdown, {
      baseUrl: this.props.baseUrl,
    });
    this.#ref.current!.innerHTML = htmlContent;
  }
  override componentWillReceiveProps(nextProps: MarkdownProps) {
    if (this.props.markdown !== nextProps.markdown) {
      const htmlContent = marked.marked(nextProps.markdown, {
        baseUrl: this.props.baseUrl,
      });
      this.#ref.current!.innerHTML = htmlContent;
    }
  }
  render(props: MarkdownProps) {
    return <div className={props.className} ref={this.#ref}></div>;
  }
}

export default Markdown;
