import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import AppIcon from '../../src/components/common/AppIcon';

afterEach(cleanup);

describe('AppIcon artwork recovery', () => {
  it('shows fallback after failure and retries when the artwork URL changes', () => {
    const { rerender } = render(<AppIcon url="https://example.test/old.png" name="Via" />);
    fireEvent.error(screen.getByRole('img', { name: 'Via' }));
    expect(screen.getByRole('img', { name: 'Via' }).tagName).toBe('DIV');
    rerender(<AppIcon url="https://example.test/new.png" name="Via" />);
    expect(screen.getByRole('img', { name: 'Via' }).getAttribute('src')).toBe('https://example.test/new.png');
  });
});
