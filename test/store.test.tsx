import { act, renderHook } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defineStore } from '../src/index.js';

interface CounterState {
  count: number;
  label: string;
}

const counter = defineStore<CounterState>('counter')((set) => ({
  increment: () => set((state) => ({ count: state.count + 1, label: state.label })),
  setLabel: (label: string) => set((state) => ({ count: state.count, label }))
}));

const initialState: CounterState = { count: 0, label: 'a' };

const wrapper: (props: { children: ReactNode }) => ReactElement = ({ children }) => (
  <counter.Provider initialState={initialState}>{children}</counter.Provider>
);

describe('defineStore', () => {
  it('returns the full state when no selector is given', () => {
    const { result } = renderHook(() => counter.useStore(), { wrapper });

    expect(result.current).toEqual(initialState);
  });

  it('returns the selected slice of state', () => {
    const { result } = renderHook(() => counter.useStore((state) => state.count), { wrapper });

    expect(result.current).toBe(0);
  });

  it('re-renders subscribers when the selected value changes', () => {
    const { result } = renderHook(
      () => {
        const count = counter.useStore((state) => state.count);
        const actions = counter.useActions();

        return { count, actions };
      },
      { wrapper }
    );

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.actions.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('does not re-render when a non-selected slice changes', () => {
    const renderCount = vi.fn();

    const { result } = renderHook(
      () => {
        const count = counter.useStore((state) => state.count);
        const actions = counter.useActions();

        renderCount();

        return { count, actions };
      },
      { wrapper }
    );

    const rendersBefore = renderCount.mock.calls.length;

    act(() => {
      result.current.actions.setLabel('b');
    });

    expect(renderCount.mock.calls.length).toBe(rendersBefore);
  });

  it('returns referentially stable actions across re-renders', () => {
    const { result, rerender } = renderHook(() => counter.useActions(), { wrapper });

    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('uses the full state successfully with an inline default selector', () => {
    const { result } = renderHook(() => counter.useStore(), { wrapper });

    expect(result.current).toEqual(initialState);
  });

  it('throws when useStore is used outside of its provider', () => {
    expect(() => renderHook(() => counter.useStore())).toThrow(
      /useStore must be used within <counter\.Provider>/
    );
  });

  it('throws when useActions is used outside of its provider', () => {
    expect(() => renderHook(() => counter.useActions())).toThrow(
      /useActions must be used within <counter\.Provider>/
    );
  });

  it('isolates state between provider instances', () => {
    const first: (props: { children: ReactNode }) => ReactElement = ({ children }) => (
      <counter.Provider initialState={{ count: 100, label: 'first' }}>{children}</counter.Provider>
    );

    const second: (props: { children: ReactNode }) => ReactElement = ({ children }) => (
      <counter.Provider initialState={{ count: 200, label: 'second' }}>{children}</counter.Provider>
    );

    const { result: firstResult } = renderHook(
      () => ({
        count: counter.useStore((state) => state.count),
        actions: counter.useActions()
      }),
      { wrapper: first }
    );

    const { result: secondResult } = renderHook(
      () => ({
        count: counter.useStore((state) => state.count),
        actions: counter.useActions()
      }),
      { wrapper: second }
    );

    expect(firstResult.current.count).toBe(100);
    expect(secondResult.current.count).toBe(200);

    act(() => {
      firstResult.current.actions.increment();
    });

    expect(firstResult.current.count).toBe(101);
    expect(secondResult.current.count).toBe(200);
  });
});
