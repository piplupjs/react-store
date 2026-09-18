# @piplup/react-store

SSR-safe, Context-scoped React state management that lives in your component tree instead of as a global singleton.

## Features

* **Provider-scoped** — each `<Provider>` creates an isolated store instance.
* **Selectors** — subscribe to specific state slices with `Object.is` comparison.
* **Stable actions** — actions retain the same identity for the lifetime of the provider.
* **SSR-safe** — store instances live inside the React tree.
* **Composable** — nest multiple providers with `compose`.
* **Zero runtime dependencies** — React only.

## Requirements

* Node.js `>= 18`
* React `>= 18`

## Installation

```bash
pnpm add @piplup/react-store
```

## Quick Start

Define a store with its state and actions:

```tsx
import { defineStore } from '@piplup/react-store';

interface CounterState {
  count: number;
}

const counter = defineStore<CounterState>('counter')((set) => ({
  increment: () => set((state) => ({ count: state.count + 1 })),
  reset: () => set({ count: 0 }),
}));
```

Mount the provider:

```tsx
<counter.Provider initialState={{ count: 0 }}>
  <App />
</counter.Provider>
```

Read state with a selector:

```tsx
function Count() {
  const count = counter.useStore((state) => state.count);

  return <div>{count}</div>;
}
```

Use actions to update state:

```tsx
function Controls() {
  const actions = counter.useActions();

  return <button onClick={actions.increment}>Increment</button>;
}
```

Read the complete state when needed:

```tsx
const state = counter.useStore();
```

Hooks throw when used outside their provider.

## Composing Providers

Use `compose` to combine multiple providers:

```tsx
import { compose, provider } from '@piplup/react-store';

const App = compose(
  provider(counter.Provider, { initialState: { count: 0 } }),
  provider(ThemeProvider, { theme }),
)(Root);
```

The last provider passed to `compose` wraps the component directly.

## API

### `defineStore<TState>(name)`

Creates a provider-scoped store definition.

```ts
defineStore<TState>(name)((set) => TActions)
```

Returns:

* **`Provider`** — creates an isolated store instance.
* **`useStore()`** — returns the complete state.
* **`useStore(selector)`** — subscribes to a selected state value.
* **`useActions()`** — returns the stable actions object.

`Provider` accepts `initialState` as the store's initial value. It is not a syncing prop.

### `provider(Component, props?)`

Creates a provider definition for use with `compose`.

### `compose(...providers)(Component)`

Wraps a component with multiple providers.

## License

Apache-2.0
