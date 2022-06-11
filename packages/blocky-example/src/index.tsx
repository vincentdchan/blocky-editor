import { render, Component } from "preact";
import { DocumentState, makeDefaultEditorEntry, type EditorRegistry, markup, makeDefaultIdGenerator } from "blocky-core";
import { BlockyEditor } from "blocky-preact";
import "blocky-core/css/blocky-core.css";

const appId = "blocky-example-app";

const idGenerator = makeDefaultIdGenerator();
const m = new markup.MarkupGenerator(idGenerator);

class App extends Component<{}> {
  private docState: DocumentState;
  private registry: EditorRegistry;

  constructor(props: {}) {
    super(props);
    this.docState = DocumentState.fromMarkup(
      m.doc([m.line([m.span("Hello World")])]),
    );
    console.log("doc: ", this.docState);
    this.registry = makeDefaultEditorEntry();
  }

  render() {
    return (
      <div className="blocky-example-container">
        <BlockyEditor options={{
          state: this.docState,
          registry: this.registry,
        }} />
      </div>
    );
  }

}

render(<App />, document.getElementById(appId)!);
