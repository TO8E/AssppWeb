import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import PageContainer from '../../src/components/Layout/PageContainer';
import { useSearch } from '../../src/hooks/useSearch';

afterEach(cleanup);

it('returns from a directly opened detail without relying on browser history', () => {
  render(<MemoryRouter initialEntries={['/downloads/task']}><Routes>
    <Route path="/downloads/task" element={<PageContainer back={{ to: '/downloads', label: '返回下载' }}>安装包详情</PageContainer>} />
    <Route path="/downloads" element={<h1>下载列表</h1>} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: '返回下载' }));
  expect(screen.getByRole('heading', { name: '下载列表' })).toBeInTheDocument();
});

it('preserves the app storefront and search query when returning from versions', () => {
  const state = { app: { id: 123, name: 'Via' }, country: 'CN' };
  useSearch.setState({ term: 'via', country: 'CN' });
  function AppPage() {
    const location = useLocation();
    return <p>{location.state.app.name} {location.state.country}</p>;
  }
  render(<MemoryRouter initialEntries={['/search/123/versions']}><Routes>
    <Route path="/search/123/versions" element={<PageContainer back={{ to: '/search/123', label: '返回应用详情', state }}>版本</PageContainer>} />
    <Route path="/search/123" element={<AppPage />} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole('link', { name: '返回应用详情' }));
  expect(screen.getByText('Via CN')).toBeInTheDocument();
  expect(useSearch.getState().term).toBe('via');
});
