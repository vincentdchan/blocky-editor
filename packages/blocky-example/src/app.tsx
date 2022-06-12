import { Component, JSX } from "preact";
import { type Editor, EditorController } from "blocky-core";
import { BlockyEditor, makePreactBannerOptions } from "blocky-preact";
import makeBoldedTextPlugin from "blocky-core/dist/plugins/boldedTextPlugin";
import Banner from "./banner";
import "blocky-core/css/bolded-text-plugin.css";
import "blocky-core/css/blocky-core.css";
import "./app.scss";

interface AppState {
  headingContent: string;
}

function makeController(): EditorController {
  return new EditorController({
    plugins: [makeBoldedTextPlugin()],
    banner: makePreactBannerOptions((editor: Editor) => (
      <Banner editor={editor} />
    )),
  });
}

class App extends Component<{}, AppState> {
  private editorController: EditorController;

  constructor(props: {}) {
    super(props);
    this.editorController = makeController();
    this.state = {
      headingContent: "Blocky Editor",
    };
  }

  private handleHeadingChanged = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    this.setState({
      headingContent: (e.target! as HTMLInputElement).value,
    });
  };

  render() {
    return (
      <div className="blocky-example-app-window">
        <div className="blocky-example-container">
          <div className="blocky-example-title-container">
            <input
              value={this.state.headingContent}
              onChange={this.handleHeadingChanged}
            />
          </div>
          <BlockyEditor controller={this.editorController} />
        </div>
      </div>
    );
  }
}

export default App;
