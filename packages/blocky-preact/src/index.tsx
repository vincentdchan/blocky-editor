import { Component, createRef, type RefObject } from "preact";
import { Editor, type IEditorOptions } from "blocky-core";

interface Props {
  options: IEditorOptions;
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
  }

  override componentWillUnmount() {
    this.#editor?.dispose();
    this.#editor = undefined;
  }

  render() {
    return (
      <div ref={this.#containerRef}></div>
    );
  }

}
