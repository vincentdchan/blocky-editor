import { test, expect, vi } from "vitest";
import { Slot } from "../events";

test("test slot", () => {
  const slot = new Slot<number>();
  const spy = vi.fn();
  slot.on(spy);
  slot.emit(1);
  expect(spy).toHaveBeenNthCalledWith(1, 1);
});

test("test dispose listener", () => {
  const slot = new Slot();
  const spy = vi.fn();
  const disposable = slot.on(spy);
  slot.emit();
  disposable.dispose();
  slot.emit();
  expect(spy).toHaveBeenCalledTimes(1);
});

test("test dispose slot", () => {
  const slot = new Slot();
  const spy = vi.fn();
  slot.on(spy);
  slot.emit();
  slot.dispose();
  slot.emit();
  expect(spy).toHaveBeenCalledTimes(1);
});
