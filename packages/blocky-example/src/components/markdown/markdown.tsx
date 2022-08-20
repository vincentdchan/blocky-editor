import { Component, createRef } from "preact";
import * as marked from "marked";

export interface MarkdownProps {
  markdown: string;
}

class Markdown extends Component<MarkdownProps> {
  #ref = createRef<HTMLDivElement>();
  override componentDidMount() {
    const htmlContent = marked.marked(this.props.markdown);
    this.#ref.current!.innerHTML = htmlContent;
  }
  render() {
    return <div ref={this.#ref}></div>;
  }
}

export default Markdown;
