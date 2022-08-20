import { Component } from "preact";
import Markdown from "@pkg/components/markdown";

class Documentation extends Component {
  render() {
    return (
      <div>
        <Markdown markdown="abc" />
      </div>
    );
  }
}

export default Documentation;
