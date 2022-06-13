import { Component } from "preact";

export interface DefaultBlockOutlineProps {
  children?: any;
}

export class DefaultBlockOutline extends Component<DefaultBlockOutlineProps> {

  override render(props: DefaultBlockOutlineProps) {
    const { children } = props;
    return (
      <div className="blocky-default-block-outline">
        {children}
      </div>
    )
  }

}
