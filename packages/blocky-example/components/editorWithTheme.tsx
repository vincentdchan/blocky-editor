import { useEffect, RefObject, useContext } from "react";
import { EditorController, darkTheme } from "blocky-core";
import { BlockyEditor } from "blocky-react";
import { Theme, blockyExampleFont } from "@pkg/app/themeSwitch";

interface BlockyEditorWithThemeProps {
  controller: EditorController | null;
  ignoreInitEmpty?: boolean;
  autoFocus?: boolean;
  scrollContainer?: RefObject<HTMLElement>;
}

function BlockyEditorWithTheme(props: BlockyEditorWithThemeProps) {
  const { controller, scrollContainer } = props;
  const theme = useContext(Theme);
  const darkMode = theme.darkMode;
  useEffect(() => {
    if (!controller) {
      return;
    }
    if (darkMode) {
      controller.themeData = {
        ...darkTheme,
        font: blockyExampleFont,
      };
    } else {
      controller.themeData = {
        font: blockyExampleFont,
      };
    }
  }, [controller, darkMode]);
  return (
    <BlockyEditor
      controller={props.controller}
      autoFocus={props.autoFocus}
      ignoreInitEmpty={props.ignoreInitEmpty}
      scrollContainer={scrollContainer}
    />
  );
}

export default BlockyEditorWithTheme;
