import { describe, expect, it } from "vitest";
import { createInitialToastQueueState, dismissToast, enqueueToast, type V4Toast } from "./toast-state";

function toast(id: string, message = id): V4Toast {
  return { id, message, tone: "info" };
}

describe("toast-state", () => {
  it("creates default queue state with max 2 visible", () => {
    const state = createInitialToastQueueState();
    expect(state.maxVisible).toBe(2);
    expect(state.visible).toEqual([]);
    expect(state.queued).toEqual([]);
  });

  it("throws for invalid maxVisible", () => {
    expect(() => createInitialToastQueueState(0)).toThrow("maxVisible");
  });

  it("fills visible toasts up to max then queues the rest", () => {
    let state = createInitialToastQueueState(2);
    state = enqueueToast(state, toast("a"));
    state = enqueueToast(state, toast("b"));
    state = enqueueToast(state, toast("c"));
    expect(state.visible.map((item) => item.id)).toEqual(["a", "b"]);
    expect(state.queued.map((item) => item.id)).toEqual(["c"]);
  });

  it("promotes queued toast when visible toast is dismissed", () => {
    let state = createInitialToastQueueState(2);
    state = enqueueToast(state, toast("a"));
    state = enqueueToast(state, toast("b"));
    state = enqueueToast(state, toast("c"));

    state = dismissToast(state, "a");

    expect(state.visible.map((item) => item.id)).toEqual(["b", "c"]);
    expect(state.queued).toEqual([]);
  });

  it("removes queued toast without affecting visible toasts", () => {
    let state = createInitialToastQueueState(2);
    state = enqueueToast(state, toast("a"));
    state = enqueueToast(state, toast("b"));
    state = enqueueToast(state, toast("c"));

    state = dismissToast(state, "c");

    expect(state.visible.map((item) => item.id)).toEqual(["a", "b"]);
    expect(state.queued).toEqual([]);
  });

  it("ignores duplicate toast ids", () => {
    let state = createInitialToastQueueState(2);
    state = enqueueToast(state, toast("a", "first"));
    state = enqueueToast(state, toast("a", "duplicate"));
    expect(state.visible).toHaveLength(1);
    expect(state.visible[0]?.message).toBe("first");
  });

  it("returns same state when dismissing unknown toast", () => {
    const state = createInitialToastQueueState(2);
    expect(dismissToast(state, "missing")).toBe(state);
  });
});

