import { RefObject, useContext, useEffect, useRef, useState } from "react";
import ReactDOM, { createPortal } from "react-dom";
import Mask from "@pkg/components/mask";
import { ReactTheme } from "@pkg/reactTheme";
import { themeDataToCssVariables } from "blocky-core";

export interface DropdownProps {
  show?: boolean;
  onMaskClicked?: () => void;
  overlay: () => React.ReactNode;
  children?: any;
  anchorRef: RefObject<HTMLElement>;
}

interface Coord {
  x: number;
  y: number;
}

const zero: Coord = { x: 0, y: 0 };
const margin = 24;

function fixMenuCoord(
  coord: Coord,
  winWidth: number,
  winHeight: number,
  menuWidth: number,
  menuHeight: number
): Coord {
  const { x, y } = coord;
  if (x + menuWidth + margin > winWidth) {
    coord.x = winWidth - menuWidth - margin;
  }
  if (y + menuHeight + margin > winHeight) {
    coord.y = winHeight - menuHeight - margin;
  }
  return coord;
}

function Dropdown(props: DropdownProps) {
  const { children, show, onMaskClicked, overlay, anchorRef } = props;
  const [menuCoord, setMenuCoord] = useState<Coord>(zero);
  const [shown, setShown] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const themeData = useContext(ReactTheme);

  useEffect(() => {
    if (show) {
      setMenuCoord({ x: -1000, y: -1000 });
      window.requestAnimationFrame(() => {
        setShown(true);
      });
    } else {
      ReactDOM.unstable_batchedUpdates(() => {
        setMenuCoord({ x: -1000, y: -1000 });
        setShown(false);
      });
    }
  }, [show, anchorRef]);

  useEffect(() => {
    if (shown) {
      const rect = anchorRef.current!.getBoundingClientRect();
      const contentRect = contentRef.current!.getBoundingClientRect();
      const x = rect.x - rect.width - contentRect.width;
      const y = rect.y + rect.height / 2 - contentRect.height / 2;

      const fixedCoord = fixMenuCoord(
        { x, y },
        window.innerWidth,
        window.innerHeight,
        contentRect.width,
        contentRect.height
      );
      setMenuCoord(fixedCoord);
    }
  }, [shown]);

  return (
    <>
      {children}
      {show &&
        createPortal(
          <Mask onClick={onMaskClicked}>
            <div
              ref={contentRef}
              style={{
                position: "fixed",
                left: `${menuCoord.x}px`,
                top: `${menuCoord.y}px`,
                ...themeDataToCssVariables(themeData),
              }}
            >
              {overlay()}
            </div>
          </Mask>,
          document.body
        )}
    </>
  );
}

export default Dropdown;
