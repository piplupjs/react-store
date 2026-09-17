import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { compose, provider } from '../src/index.js';

function Layer({ color, children }: { color?: string; children?: ReactNode }) {
  return (
    <section data-color={color}>
      <span>{color ?? 'none'}</span>
      {children}
    </section>
  );
}

function Main() {
  return <div className="main">main</div>;
}

describe('compose', () => {
  it('wraps the component with providers, innermost-last', () => {
    const Composed = compose(
      provider(Layer, { color: 'outer' }),
      provider(Layer, { color: 'inner' })
    )(Main);

    const { container } = render(<Composed />);

    const outer = container.querySelector('[data-color="outer"]');
    const inner = container.querySelector('[data-color="inner"]');

    expect(outer).not.toBeNull();
    expect(inner).not.toBeNull();
    expect(outer?.contains(inner)).toBe(true);
    expect(inner?.textContent).toContain('main');
  });

  it('supports providers without props', () => {
    const Composed = compose(provider(Layer))(Main);

    const { container } = render(<Composed />);

    expect(container.querySelector('section')).not.toBeNull();
    expect(container.querySelector('span')?.textContent).toBe('none');
    expect(container.textContent).toContain('main');
  });

  it('passes provider props through', () => {
    const Composed = compose(provider(Layer, { color: 'blue' }))(Main);

    const { container } = render(<Composed />);

    expect(container.querySelector('[data-color="blue"]')).not.toBeNull();
  });

  it('sets a displayName from the wrapped component', () => {
    const Composed = compose(provider(Layer))(Main) as unknown as { displayName?: string };

    expect(Composed.displayName).toBe('compose(Main)');
  });
});
