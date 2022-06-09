import { ComponentChild, render } from "preact";
import { unmountComponentAtNode } from "preact/compat";
import { removeElement, elem, isContainNode, $on } from "./dom";
import { type IDisposable, flattenDisposable } from "common/disposable";
import { Slot } from "common/events";

interface Size {
  width: number;
  height: number;
}

export type Direction =
  | "top"
  | "bottom"
  | "left"
  | "right"

export interface MountTooltipOptions {
  direction: Direction;
  render: ComponentChild;
  delay?: number;
}

const PADDING = 6;
const PRESERVE_PADDING = 24;

export function getPopupCoord(direction: Direction, rect: DOMRect, popupSize: Size): [number, number] {
  let x = rect.x;
  let y = rect.y;
  const { width: popupWidth, height: popupHeight } = popupSize;
  const tooltipWidth = popupWidth | 0;
  switch (direction) {
    case "top": {
      x += rect.width / 2 - tooltipWidth / 2 | 0;
      y = y - popupHeight - PADDING | 0;
      break;
    }

    case "bottom": {
      x += rect.width / 2 - tooltipWidth / 2 | 0;
      y += rect.height;
      y += PADDING;
      break;
    }

    case "right": {
      x += rect.width + PADDING | 0;
      break;
    }

    default: {}

  }

  const { innerWidth } = window;
  if (x + tooltipWidth >= innerWidth) {
    x = innerWidth - PRESERVE_PADDING - tooltipWidth;
  }

  return [x, y];
}

export function mountTooltip(elm: HTMLElement, options: MountTooltipOptions): IDisposable {
  let tooltipContainer: HTMLDivElement | undefined;
  let timer: any | undefined;

  const delay = options.delay || 240;

  const cleaup = () => {
    if (!tooltipContainer) {
      return;
    }
    unmountComponentAtNode(tooltipContainer);
    removeElement(tooltipContainer);
    tooltipContainer = undefined;
  }

  const animationEnd = () => {
    cleaup();
  }

  const mouseEnterHandler = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      const rect = elm.getBoundingClientRect();

      tooltipContainer = elem("div", "tilecraft-tooltip-container");
      tooltipContainer.style.position = "fixed";
      // pre-render in far away
      tooltipContainer.style.top = -window.innerHeight + "px";
      tooltipContainer.style.left = "0px";
      $on(tooltipContainer, "animationend", animationEnd),

      render(options.render, tooltipContainer);
      document.body.appendChild(tooltipContainer);

      window.requestAnimationFrame(() => {
        const tooltipRect = tooltipContainer!.getBoundingClientRect();
        const [x, y] = getPopupCoord(options.direction, rect, {
          width: tooltipRect.width,
          height: tooltipRect.height,
        });
        tooltipContainer!.style.top = y + "px";
        tooltipContainer!.style.left = x + "px";
      });
    }, delay);
  }

  const fadeOut = () => {
    if (!tooltipContainer) {
      return;
    }
    tooltipContainer.classList.add("fadeOut");
  }

  const mouseLeaveHandler = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
    fadeOut();
  };

  const disposables: IDisposable[] = [
    $on(elm, "mouseenter", mouseEnterHandler),
    $on(elm, "mouseleave", mouseLeaveHandler),
  ];

  disposables.push({
    dispose: () => {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (!tooltipContainer) {
        return;
      }
      cleaup();
      tooltipContainer = undefined;
    }
  })

  return flattenDisposable(disposables);
}

export interface MiniWindowContentRenderer {
  render(parent: HTMLElement): void;
  unmount?(container: HTMLElement): void;
}

export class MiniWindowMounter {

  #container: HTMLDivElement;
  #contentContainer: HTMLDivElement;

  public readonly readyToExit: Slot = new Slot();

  constructor(private renderer: MiniWindowContentRenderer) {
    this.#container = elem("div", "tilecraft-mini-window-container");
    this.#container.style.position = "fixed";

    // this.#container.style.width = width + "px";
    // this.#container.style.width = "200px";
    this.#container.style.height = 0 + "px";

    this.#contentContainer = elem("div", "tilecraft-mini-window-content");
    this.#contentContainer.style.width = "100%";
    this.#container.appendChild(this.#contentContainer);
  }

  private handleWindowClicked = (e: MouseEvent) => {
    if (e.target && isContainNode(e.target as HTMLElement, this.#contentContainer)) {
      return;
    }
    this.dispose();
  }

  private __target: HTMLElement | undefined;

  hook(target: HTMLElement) {
    this.__target = target;
    this.render();
    this.layout();
    window.requestAnimationFrame(() => {
      window.addEventListener("resize", this.handleWindowResized);
      window.addEventListener("click", this.handleWindowClicked);
    });
  }

  private layout() {
    window.requestAnimationFrame(() => {
      if (!this.__target) {
        return;
      }
      const targedRect = this.__target.getBoundingClientRect();
      const popupRect = this.#contentContainer.getBoundingClientRect();
      const [x, y] = getPopupCoord("bottom", targedRect, {
        width: popupRect.width,
        height: popupRect.height,
      });
      this.#container.style.top = y + "px";
      this.#container.style.left = x + "px";

      this.#container.style.height = (window.innerHeight - targedRect.top - 64 | 0) + "px";
    });
  }

  private handleWindowResized = () => {
    this.layout();
  }

  private render() {
    document.body.append(this.#container);
    this.renderer.render(this.#contentContainer);
  }

  dispose() {
    this.readyToExit.emit();
    this.readyToExit.dispose();

    window.removeEventListener("resize", this.handleWindowResized);
    window.removeEventListener("click", this.handleWindowClicked);

    if (this.renderer.unmount) {
      this.renderer.unmount(this.#contentContainer);
    }

    removeElement(this.#container);
  }

}
