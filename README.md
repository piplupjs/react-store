# @piplup/react-store

Context-scoped React state management that lives in your component tree
instead of as a global singleton.

## The problem

Most state managers are built around a single global store that lives
outside React. Because that store is shared across your whole app, your
tests, and even your requests, it causes bugs:

- **Stale state across screens** — a global store survives navigation, so
  the next view can read the previous view's state.
- **SSR hydration mismatches** — an external store is populated from server
  code, so the server-rendered markup can differ from what React's provider
  tree produces on the client.
- **Test pollution** — one test mutates the shared store; the next test
  starts from that leftover state unless you remember to reset globals.
- **No isolation** — you cannot cheaply mount the same feature twice (for
  example two independent checkouts), because there is only "the" store.

## What this package does differently

Instead of a module-level singleton, **each `<Provider>` creates an
isolated store instance** that lives and dies with its component tree.
Selectors, subscriptions, and actions are all managed internally through
`useSyncExternalStore`, but none of that leaks into your code.

This means:

- No singleton module shared across your app.
- Multiple providers of the same store type are fully independent.
- No external subscription boilerplate in consuming components.
- No hydration mismatch in SSR (the store exists only inside React).

`useStore` subscribes to a slice of state through a selector.
`useActions` returns actions that keep a **referentially stable identity**
for the lifetime of the provider.

## Features

- **Provider-scoped, not global** — each `<store.Provider>` is its own isolated
  store; no singleton shared across your bundle.
- **Selector-driven re-renders** — a component re-renders only when the
  selected value changes (`Object.is`), without you wiring up
  `useSyncExternalStore`.
- **Stable actions** — actions are created once per provider and never
  change identity.
- **SSR-safe** — the store exists entirely inside React, so there is no
  external state that hydrates out of sync.
- **`compose`** for nesting providers into a single component.
- Zero runtime dependencies (React only).
- ESM-only, fully typed (`.d.ts` included).

## Requirements

- Node.js `>= 18`
- React `>= 18` (`useSyncExternalStore`)

## Installation

```bash
# pnpm
pnpm add @piplup/react-store

# npm
npm install @piplup/react-store

# yarn
yarn add @piplup/react-store
```

## Quick Start

Define a store with its initial state shape and its actions:

```tsx
import { defineStore } from '@piplup/react-store';

interface CounterState {
  count: number;
}

const counter = defineStore<CounterState>('counter')((set) => ({
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 })
}));
```

Mount a provider with the initial state:

```tsx
<counter.Provider initialState={{ count: 0 }}>
  <App />
</counter.Provider>
```

Read state with the `useStore` hook. Pass a selector to subscribe to a
slice of the state:

```tsx
function Count() {
  const count = counter.useStore((state) => state.count);

  return <div>{count}</div>;
}
```

Mutate state through actions:

```tsx
function Controls() {
  const actions = counter.useActions();

  return <button onClick={actions.increment}>Increment</button>;
}
```

You can also read the whole state (no selector):

```tsx
const state = counter.useStore();
```

Hooks throw if used outside of their provider:

```
counter: useStore must be used within <counter.Provider>.
```

## Composing Providers

Use `compose` to wrap a component with any number of providers in a single,
memoized component:

```tsx
import { compose, provider } from '@piplup/react-store';

const App = compose(
  provider(counter.Provider, { initialState: { count: 0 } }),
  provider(ThemeProvider, { theme })
)(Root);
```

`provider` wraps a component and, optionally, its props. `compose` renders
the innermost provider first: the last provider passed to `compose` wraps
the component directly.

## API

### `defineStore<TState>(name)`

Returns a function that accepts an action factory:

```ts
defineStore<TState>(name).(createActions: (set) => TActions)
```

and returns:

- **`Provider`** — `<Provider initialState={...}>{children}</Provider>`.
  `initialState` is an initializer, not a syncing value.
- **`useStore()`** — returns the whole state.
- **`useStore<TResult>(selector)`** — subscribes to a selected value;
  re-renders only when the selected value changes.
- **`useActions()`** — returns the actions object (stable identity).

### `provider(Component, props?)`

A `ProviderDefinition` helper for `compose`.

### `compose(...providers)(Component)`

Wraps `Component` in the given providers, innermost-last.

## License

Apache-2.0
