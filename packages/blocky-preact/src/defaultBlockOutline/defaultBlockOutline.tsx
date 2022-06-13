import { Component } from "preact";
import { ReactBlockContext } from "../reactBlock";
import { type EditorController } from "blocky-core";

interface DefaultBlockOutlineInternalProps {
  editorController: EditorController;
  blockId: string;
  children?: any;
}

class DefaultBlockOutlineInternal extends Component<DefaultBlockOutlineInternalProps> {
  override render(props: DefaultBlockOutlineInternalProps) {
    const { children } = props;
    return <div className="blocky-default-block-outline">{children}</div>;
  }
}

export interface DefaultBlockOutlineProps {
  children?: any;
}

export function DefaultBlockOutline(props: DefaultBlockOutlineProps) {
  return (
    <ReactBlockContext.Consumer>
      {(ctx) => (
        <DefaultBlockOutlineInternal
          editorController={ctx!.editorController}
          blockId={ctx!.blockId}
          {...props}
        />
      )}
    </ReactBlockContext.Consumer>
  );
}
