import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState, useSyncExternalStore } from 'react';

//#region Types

export type SetStore<TState> = (update: TState | ((prev: Readonly<TState>) => TState)) => void;

type Listener = () => void;

type Selector<TState extends object, TResult> = (state: Readonly<TState>) => TResult;

interface Store<TState extends object> {
  /**
   * Returns the current state object.
   *
   * The reference remains stable until setState replaces it.
   */
  getState(): Readonly<TState>;

  /**
   * Replaces the current state and notifies subscribers when the
   * state reference changes.
   */
  setState: SetStore<TState>;

  /**
   * Subscribes to store changes.
   *
   * Returns an unsubscribe function. Calling it multiple times
   * is safe.
   */
  subscribe(listener: Listener): () => void;
}

interface ProviderProps<TState extends object> {
  children: ReactNode;
  initialState: Readonly<TState>;
}

interface SelectorSubscription<TResult> {
  /**
   * Returns the last computed selector result.
   *
   * This value is cached so that useSyncExternalStore always
   * receives a stable snapshot between store changes.
   */
  getSnapshot(): TResult;

  /**
   * Returns the initial selector result used during SSR.
   */
  getServerSnapshot(): TResult;

  /**
   * Subscribes to changes in the selected value.
   */
  subscribe(listener: Listener): () => void;
}

//#endregion

//#region Store

function createStore<TState extends object>(initialState: Readonly<TState>): Store<TState> {
  let state = initialState;

  const listeners = new Set<Listener>();

  const getState = (): Readonly<TState> => state;

  const setState: SetStore<TState> = (update) => {
    const nextState = typeof update === 'function' ? update(state) : update;

    /*
     * State identity is the store's change boundary.
     *
     * Consumers should replace the state object rather than
     * mutate the existing object in place.
     */
    if (Object.is(state, nextState)) {
      return;
    }

    state = nextState;

    /*
     * Iterate over a snapshot of the listeners.
     *
     * This prevents adding/removing listeners during notification
     * from affecting the current notification cycle.
     */
    for (const listener of Array.from(listeners)) {
      listener();
    }
  };

  const subscribe = (listener: Listener): (() => void) => {
    listeners.add(listener);

    /*
     * Set.delete() makes unsubscribe idempotent.
     */
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState,
    setState,
    subscribe
  };
}

//#endregion

//#region Selector Subscription

/**
 * Creates a React-compatible subscription for a selector.
 *
 * The underlying store only knows about complete state snapshots.
 * Selector-specific behavior lives here, keeping the store itself
 * independent of React and selector semantics.
 */
function createSelectorSubscription<TState extends object, TResult>(
  store: Store<TState>,
  selector: Selector<TState, TResult>
): SelectorSubscription<TResult> {
  let state = store.getState();
  let selected = selector(state);

  /*
   * useSyncExternalStore requires getSnapshot() to return a cached
   * value. The selector must therefore not run from getSnapshot().
   */
  const getSnapshot = (): TResult => selected;

  /*
   * The initial selected value is also the server snapshot.
   *
   * Because the subscription is created from the current store,
   * this remains consistent with the store's initial state.
   */
  const getServerSnapshot = (): TResult => selected;

  const sync = (): boolean => {
    const nextState = store.getState();

    if (Object.is(state, nextState)) {
      return false;
    }

    state = nextState;

    const nextValue = selector(nextState);

    if (Object.is(selected, nextValue)) {
      return false;
    }

    selected = nextValue;

    return true;
  };

  const subscribe = (listener: Listener): (() => void) => {
    const unsubscribe = store.subscribe(() => {
      if (sync()) {
        listener();
      }
    });

    // Close the render-to-subscribe gap for updates that already occurred.
    if (sync()) {
      listener();
    }

    return unsubscribe;
  };

  return {
    getSnapshot,
    getServerSnapshot,
    subscribe
  };
}

//#endregion

//#region Store Definition

function defaultSelector<TState extends object>(state: Readonly<TState>): Readonly<TState> {
  return state;
}

export function defineStore<TState extends object>(name: string) {
  return function defineStoreWithActions<TActions extends object>(
    createActions: (set: SetStore<TState>) => TActions
  ) {
    const StoreContext = createContext<Store<TState> | null>(null);

    const ActionsContext = createContext<TActions | null>(null);

    if (process.env.NODE_ENV !== 'production') {
      StoreContext.displayName = `${name}.StoreContext`;
      ActionsContext.displayName = `${name}.ActionsContext`;
    }

    function Provider({ children, initialState }: ProviderProps<TState>) {
      /*
       * The store is created once per Provider instance.
       *
       * initialState is therefore an initializer, not a value that
       * synchronizes the store after the Provider has mounted.
       */
      const [store] = useState(() => createStore(initialState));

      /*
       * Actions are created once and retain the same identity for
       * the lifetime of this Provider.
       */
      const [actions] = useState(() => createActions(store.setState));

      return (
        <StoreContext.Provider value={store}>
          <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
        </StoreContext.Provider>
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      Provider.displayName = `${name}.Provider`;
    }

    function useStoreContext(): Store<TState> {
      const store = useContext(StoreContext);

      if (store === null) {
        throw new Error(`${name}: useStore must be used within <${name}.Provider>.`);
      }

      return store;
    }

    /**
     * Subscribes to a selected portion of the store state.
     *
     * Example:
     *
     *     const username = useStore(
     *         state => state.user.name,
     *     );
     *
     * The component only receives an update when the selected
     * value changes according to Object.is().
     */
    function useStore(): Readonly<TState>;
    function useStore<TResult>(selector: Selector<TState, TResult>): TResult;
    function useStore<TResult>(selector?: Selector<TState, TResult>): TResult | Readonly<TState> {
      const store = useStoreContext();
      const resolvedSelector: Selector<TState, TResult | Readonly<TState>> =
        selector ?? defaultSelector;
      const subscription = useMemo(
        () => createSelectorSubscription(store, resolvedSelector),
        [store, resolvedSelector]
      );

      return useSyncExternalStore(
        subscription.subscribe,
        subscription.getSnapshot,
        subscription.getServerSnapshot
      );
    }

    /**
     * Returns the actions associated with this store.
     *
     * Actions are created once by Provider and therefore remain
     * referentially stable.
     */
    function useActions(): Readonly<TActions> {
      const actions = useContext(ActionsContext);

      if (actions === null) {
        throw new Error(`${name}: useActions must be used within <${name}.Provider>.`);
      }

      return actions;
    }

    return {
      Provider,
      useActions,
      useStore
    };
  };
}

//#endregion
