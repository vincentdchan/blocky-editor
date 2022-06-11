import { Component, createRef, type RefObject } from "preact";
import { Editor, type IEditorOptions } from "blocky-core";

export type CleanOptions = Omit<IEditorOptions, "container">;

export interface Props {
  options: CleanOptions;
}

export class BlockyEditor extends Component<Props> {

  #editor: Editor | undefined;
  #containerRef: RefObject<HTMLDivElement> = createRef();

  override componentDidMount() {
    const { options } = this.props;
    this.#editor = new Editor({
      ...options,
      container: this.#containerRef.current!,
    });
    this.#editor.render();
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
