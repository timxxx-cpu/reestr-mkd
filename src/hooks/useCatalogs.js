import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CatalogService } from '../lib/catalog-service';

export function useCatalog(table) {
  const query = useQuery({
    queryKey: ['catalog', table],
    queryFn: () => CatalogService.getCatalog(table),
    staleTime: 1000 * 60 * 5
  });

  const options = useMemo(() => {
    const db = query.data || [];
    return db.map((x) => ({ code: x.code, label: x.label, id: x.id, ...x }));
  }, [query.data]);

  return { ...query, options };
}
