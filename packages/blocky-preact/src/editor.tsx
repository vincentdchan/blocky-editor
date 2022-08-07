import { Component, createRef, type RefObject } from "preact";
import { type BlockElement, CursorState } from "blocky-data";
import { Editor, type EditorController } from "blocky-core";

export interface Props {
  controller: EditorController;

  /**
   * If this flag is false,
   * the editor will not create an empty
   * block automatically when the editor is created.
   */
  ignoreInitEmpty?: boolean;
}

export class BlockyEditor extends Component<Props> {
  private editor: Editor | undefined;
  private containerRef: RefObject<HTMLDivElement> = createRef();

  override componentDidMount() {
    const { controller } = this.props;
    this.editor = Editor.fromController(this.containerRef.current!, controller);
    const editor = this.editor;
    if (this.props.ignoreInitEmpty !== true) {
      editor.initFirstEmptyBlock();
    }
    editor.render(() => {
      const firstChild = editor.state.document.body.firstChild;
      if (firstChild) {
        controller.setCursorState(
          CursorState.collapse((firstChild as BlockElement).id, 0)
        );
      }
    });
  }

  override componentWillUnmount() {
    this.editor?.dispose();
    this.editor = undefined;
  }

  render() {
    return (
      <div className="blocky-editor-container" ref={this.containerRef}></div>
    );
  }
}
