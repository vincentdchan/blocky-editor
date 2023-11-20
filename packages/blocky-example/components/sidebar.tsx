import React, { memo } from "react";
import Link from "next/link";

const Sidebar = memo(() => {
  return (
    <div className="blocky-example-sidebar-container">
      <Link className="blocky-example-link" href="/">
        Home
      </Link>
      <Link className="blocky-example-link" href="/doc/get-started">
        Get started
      </Link>
      <Link className="blocky-example-link" href="/doc/api">
        Api
      </Link>
      <Link className="blocky-example-link" href="/noTitle">
        Editor without title
      </Link>
    </div>
  );
});

export default Sidebar;
