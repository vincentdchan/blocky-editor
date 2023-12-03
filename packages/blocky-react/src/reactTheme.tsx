import { EditorController, ThemeData } from "blocky-core";
import { createContext, useEffect, useState } from "react";

export const ReactTheme = createContext<ThemeData | undefined>(undefined);

export interface ThemeWrapperProps {
  editorController: EditorController;
  children?: React.ReactNode;
}

export function ThemeWrapper(props: ThemeWrapperProps) {
  const [theme, setTheme] = useState<ThemeData | undefined>(undefined);
  useEffect(() => {
    const s = props.editorController.editor?.themeData$.subscribe(setTheme);

    return () => {
      s?.unsubscribe();
    };
  }, [props.editorController]);
  return (
    <ReactTheme.Provider value={theme}>{props.children}</ReactTheme.Provider>
  );
}
