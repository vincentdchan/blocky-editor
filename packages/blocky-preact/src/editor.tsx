import { Component, createRef, type RefObject } from "preact";
import { type BlockElement, Editor, type EditorController } from "blocky-core";

export interface Props {
  controller: EditorController;
}

export class BlockyEditor extends Component<Props> {

  #editor: Editor | undefined;
  #containerRef: RefObject<HTMLDivElement> = createRef();

  override componentDidMount() {
    const { controller } = this.props;
    this.#editor = Editor.fromController(this.#containerRef.current!, controller);
    const editor = this.#editor;
    editor.render(() => {
      const firstChild = editor.state.root.firstChild;
      if (firstChild) {
        editor.state.cursorState = {
          type: "collapsed",
          targetId: (firstChild as BlockElement).id,
          offset: 0,
        };
      }
    });
  }

  override componentWillUnmount() {
    this.#editor?.dispose();
    this.#editor = undefined;
  }

  render() {
    return (
      <div className="blocky-editor-container" ref={this.#containerRef}></div>
    );
  }

}
