import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedVisibility } from "@/hooks/useDelayedVisibility";

describe("useDelayedVisibility", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stays hidden at 300ms and appears only after the wait exceeds 300ms", () => {
    const { result } = renderHook(() => useDelayedVisibility(true));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe(false);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("clears immediately and cancels stale timers", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useDelayedVisibility(active),
      { initialProps: { active: true } },
    );
    act(() => vi.advanceTimersByTime(301));
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);

    rerender({ active: true });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(150));
    rerender({ active: false });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });
});
