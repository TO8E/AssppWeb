import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSearch } from '../../hooks/useSearch';

interface PageContainerProps {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

export default function PageContainer({
  title,
  children,
  action,
}: PageContainerProps) {
  const location = useLocation();
  const clearSearch = useSearch((state) => state.clear);

  // 监听路由变化，如果当前路径不在 /search 下，则清空之前的搜索内容
  useEffect(() => {
    if (!location.pathname.startsWith('/search')) {
      clearSearch();
    }
  }, [location.pathname, clearSearch]);

  return (
    <div className="ios-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-gray-50 pb-[calc(6rem+env(safe-area-inset-bottom))] [scrollbar-gutter:stable] transition-colors duration-200 dark:bg-gray-950 md:pb-10">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {(title || action) && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {title && (
              <h1 className="min-w-0 text-2xl font-semibold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-[1.75rem]">
                {title}
              </h1>
            )}
            {action && <div className="ml-auto max-w-full">{action}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
