import * as React from 'react';

//#region Types

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

type ProviderDefinition<P extends AnyComponent> = Readonly<{
  Provider: P;
  props: Omit<React.ComponentProps<P>, 'children'>;
}>;

//#endregion

//#region Provider

export function provider<P extends AnyComponent>(Provider: P): ProviderDefinition<P>;

export function provider<P extends AnyComponent>(
  Provider: P,
  props: Omit<React.ComponentProps<P>, 'children'>
): ProviderDefinition<P>;

export function provider<P extends AnyComponent>(
  Provider: P,
  props?: Omit<React.ComponentProps<P>, 'children'>
): ProviderDefinition<P> {
  return {
    Provider,
    props: (props ?? {}) as Omit<React.ComponentProps<P>, 'children'>
  };
}

//#endregion

//#region Compose

export function compose(...providers: Readonly<Array<ProviderDefinition<AnyComponent>>>) {
  return function <P extends object>(Component: React.ComponentType<P>): React.ComponentType<P> {
    function Compose(props: P) {
      // oxlint-disable-next-line no-shadow
      return providers.reduceRight<React.ReactNode>(
        (children, provider) => {
          return React.createElement(provider.Provider, provider.props, children);
        },
        React.createElement(Component, props)
      );
    }

    if (process.env.NODE_ENV !== 'production') {
      Compose.displayName = `compose(${Component.displayName ?? Component.name ?? 'Component'})`;
    }

    return Compose as React.ComponentType<P>;
  };
}

//#endregion
