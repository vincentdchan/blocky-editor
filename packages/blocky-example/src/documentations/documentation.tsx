import { Component } from "preact";
import Markdown from "@pkg/components/markdown";
import { Link } from "preact-router/match";
import "./documentation.scss";

interface DocumentationState {
  selectedContent: string;
}

interface DocumentationProps {
  content: string;
}

class Documentation extends Component<DocumentationProps, DocumentationState> {
  constructor(props: DocumentationProps) {
    super(props);
  }
  renderSidebar() {
    return (
      <div className="sidebar">
        <Link href="/doc/get-started" className="sidebar-item">
          Get started
        </Link>
        <Link href="/doc/data-manipulations" className="sidebar-item">
          Data manipulations
        </Link>
        <Link href="/doc/how-to-write-a-block" className="sidebar-item">
          How to write a block
        </Link>
        <Link href="/doc/follower-widget" className="sidebar-item">
          Follower widget
        </Link>
      </div>
    );
  }
  render() {
    return (
      <div className="blocky-documentations">
        {this.renderSidebar()}
        <Markdown markdown={this.props.content} />
      </div>
    );
  }
}

export default Documentation;
