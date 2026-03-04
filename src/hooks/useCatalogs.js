import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CatalogService } from '../lib/catalog-service';

export function useCatalog(table) {
  const query = useQuery({
    queryKey: ['catalog', table],
    queryFn: () => CatalogService.getCatalog(table),
    staleTime: 1000 * 60 * 5,
  });

  const options = useMemo(() => {
    // Проверяем, пришел ли массив напрямую или внутри поля items
    const data = query.data;
    const db = Array.isArray(data) ? data : (data?.items || []);
    
    return db.map(x => ({ 
      code: x.code, 
      label: x.label || x.name, // Добавлено для совместимости с разными таблицами
      id: x.id, 
      ...x 
    }));
  }, [query.data]);

  return { ...query, options };
}
