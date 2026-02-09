import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Данные считаются свежими 1 минуту
      staleTime: 1000 * 60,
      // При ошибке не пытаться делать повторные запросы бесконечно
      retry: 1,
      // Не обновлять данные при фокусе окна (в dev-режиме это часто мешает)
      refetchOnWindowFocus: false,
    },
  },
});
