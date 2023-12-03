import { RefObject, useEffect } from "react";
import { Subject, fromEvent, switchMap, takeUntil, timer, map } from "rxjs";
import { css } from "@emotion/css";

export const blockyExampleFont = `Inter, system-ui, -apple-system, BlinkMacSystemFont, Roboto, 'Open Sans', 'Helvetica Neue', sans-serif`;

const tooltipStyle = css({
  fontFamily: blockyExampleFont,
  position: "fixed",
  backgroundColor: "rgb(15, 15, 15)",
  color: "rgb(231, 231, 231)",
  pointerEvents: "none",
  padding: "4px 6px",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
});

interface Size {
  width: number;
  height: number;
}

const PADDING = 4;
const PRESERVE_PADDING = 24;
const tooltipTimeout = 600;

function getPopupCoord(
  direction: Direction,
  rect: DOMRect,
  popupSize: Size
): [number, number] {
  let x = rect.x;
  let y = rect.y;
  const { width: popupWidth, height: popupHeight } = popupSize;
  const tooltipWidth = popupWidth | 0;
  switch (direction) {
    case "top": {
      x += (rect.width / 2 - tooltipWidth / 2) | 0;
      y = (y - popupHeight - PADDING) | 0;
      break;
    }

    case "bottom": {
      x += (rect.width / 2 - tooltipWidth / 2) | 0;
      y += rect.height;
      y += PADDING;
      break;
    }

    case "topLeftAligned": {
      y -= popupHeight;
      y -= PADDING;
      break;
    }

    case "bottomLeftAligned": {
      y += rect.height;
      y += PADDING;
      break;
    }

    case "bottomRightAligned": {
      x += rect.width;
      x -= tooltipWidth;
      y += rect.height;
      y += PADDING;
      break;
    }

    case "right": {
      x += (rect.width + PADDING) | 0;
      break;
    }

    default: {
    }
  }

  const { innerWidth } = window;
  if (x + tooltipWidth >= innerWidth) {
    x = innerWidth - PRESERVE_PADDING - tooltipWidth;
  }

  return [x, y];
}

export type Direction =
  | "top"
  | "topLeftAligned"
  | "bottom"
  | "bottomLeftAligned"
  | "bottomRightAligned"
  | "right";

export interface UseTooltipOptions {
  direction?: Direction;
  content: string;
  anchorElement: RefObject<HTMLElement>;
  delay?: number;
}

function getContainer() {
  let container = document.getElementById("blocky-tooltip");
  if (container) {
    return container;
  }
  container = document.createElement("div");
  container.id = "blocky-tooltip";
  document.body.appendChild(container);
  return container;
}

export function useTooltip(options: UseTooltipOptions) {
  const { content, anchorElement, direction, delay = tooltipTimeout } = options;
  useEffect(() => {
    let tooltipElement: HTMLElement | undefined;
    let isHover = false;
    const handleMouseEnter = () => {
      const element = tooltipElement;
      if (!element) {
        return;
      }
      if (!anchorElement.current) {
        return;
      }
      if (!isHover) {
        tooltipElement?.remove();
        tooltipElement = undefined;
        return;
      }
      const tooltipRect = element.getBoundingClientRect();
      const targetRect = anchorElement.current.getBoundingClientRect();
      const coord = getPopupCoord(direction ?? "bottom", targetRect, {
        width: tooltipRect.width,
        height: tooltipRect.height,
      });

      element.style.top = coord[1] + "px";
      element.style.left = coord[0] + "px";
    };

    const handleMouseLeave = () => {
      isHover = false;
      if (!tooltipElement) {
        return;
      }
      tooltipElement.remove();
      tooltipElement = undefined;
    };

    const dispose$ = new Subject<void>();
    const refObj = anchorElement.current;
    if (refObj instanceof HTMLElement) {
      fromEvent<MouseEvent>(refObj, "mouseenter")
        .pipe(
          map((e: MouseEvent) => {
            isHover = true;
            return e;
          }),
          switchMap((e) => timer(delay).pipe(map(() => e))),
          map((e: MouseEvent) => {
            e.preventDefault();
            if (tooltipElement) {
              tooltipElement.remove();
            }
            const element = document.createElement("div");
            element.classList.add(tooltipStyle);
            element.textContent = content;
            element.style.top = "-1000px";
            element.style.left = "-1000px";

            tooltipElement = element;
            getContainer().appendChild(element);
            return e;
          }),
          switchMap((e) => timer(0).pipe(map(() => e))),
          takeUntil(dispose$)
        )
        .subscribe(handleMouseEnter);
      fromEvent(refObj, "mouseleave")
        .pipe(takeUntil(dispose$))
        .subscribe(handleMouseLeave);
      fromEvent(refObj, "click")
        .pipe(takeUntil(dispose$))
        .subscribe(handleMouseLeave);
    } else {
      console.error("not an html element:", refObj);
    }

    return () => {
      dispose$.next();
      dispose$.complete();
      tooltipElement?.remove();
    };
  }, [content, anchorElement, direction]);
}
