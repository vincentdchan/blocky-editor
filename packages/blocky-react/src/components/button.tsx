import React, { memo } from "react";

const Button = memo(
  (
    props: React.DetailedHTMLProps<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      HTMLButtonElement
    >
  ) => {
    return <button className="blocky-example-button" {...props} />;
  }
);

export default Button;
