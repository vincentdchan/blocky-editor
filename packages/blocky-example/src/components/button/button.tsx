import { JSX } from "preact";
import { memo } from "preact/compat";
import "./button.scss";

const Button = memo((props: JSX.HTMLAttributes<HTMLButtonElement>) => {
  return <button className="blocky-example-button" {...props} />;
});

export default Button;
