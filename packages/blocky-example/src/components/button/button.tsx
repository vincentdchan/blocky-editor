import "./button.scss";
import { JSX } from "preact";

function Button(props: JSX.HTMLAttributes<HTMLButtonElement>) {
  return <button className="blocky-example-button" {...props} />;
}

export default Button;
