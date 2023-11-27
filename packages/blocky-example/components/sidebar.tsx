import React, { memo } from "react";
import Link from "next/link";
import styles from "./sidebar.module.scss";
import { IoHomeOutline } from "react-icons/io5";
import { IoDocumentOutline } from "react-icons/io5";

interface SidebarItemProps {
  icon?: React.ReactNode;
  href: string;
  children?: React.ReactNode;
}

function SidebarItem(props: SidebarItemProps) {
  const { icon, children, href } = props;
  return (
    <Link className={styles.item} href={href}>
      {icon ?? <IoDocumentOutline />}
      <div className={styles.content}>{children}</div>
    </Link>
  );
}

const Sidebar = memo(() => {
  return (
    <div className="blocky-example-sidebar-container">
      <SidebarItem href="/" icon={<IoHomeOutline />}>
        Home
      </SidebarItem>
      <SidebarItem href="/doc/get-started">Get started</SidebarItem>
      <SidebarItem href="/doc/api">Api</SidebarItem>
      <h2 className={styles.subTitle}>Examples</h2>
      <SidebarItem href="/noTitle">Editor without title</SidebarItem>
      <SidebarItem href="/loro">Loro CRDT</SidebarItem>
    </div>
  );
});

export default Sidebar;
