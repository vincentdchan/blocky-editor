import { test, expect, vi } from "vitest";
import { Slot } from "../slot";

test("Slot emit()", () => {
  const slot = new Slot<number>();
  const spy = vi.fn();
  slot.on(spy);
  slot.emit(0);
  expect(spy).toBeCalledWith(0);
  slot.emit(1);
  expect(spy).toBeCalledWith(1);
});

test("Slot dispose when emit", () => {
  const slot = new Slot<number>();
  const spy = vi.fn();
  const disposable = slot.on(() => {
    disposable.dispose();
    spy();
  });

  slot.emit(0);
  slot.emit(1);
  slot.emit(2);

  expect(spy).toBeCalledTimes(1);
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

test("Slot filter", () => {
  const slot = new Slot<number>();
  const even = slot.filter((n) => n % 2 == 0);
  const spy = vi.fn();
  even.on(spy);
  slot.emit(0);
  slot.emit(1);
  slot.emit(2);
  slot.emit(3);
  slot.emit(4);
  expect(spy).toBeCalledTimes(3);
});

test("Slot dispose", () => {
  const slot = new Slot<number>();
  const spy = vi.fn();
  slot.on(spy);

  slot.emit(0);
  expect(spy).toBeCalledTimes(1);
  slot.dispose();
  slot.emit(0);
  slot.emit(0);
  slot.emit(0);
  expect(spy).toBeCalledTimes(1);
});
