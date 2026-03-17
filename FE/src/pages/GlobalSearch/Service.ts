import { httpClient } from '../../services/httpClient';
import type { GlobalSearchRequest, GlobalSearchResponse, SearchableColumn } from './Model.d';

export const getSearchColumns = async (tableKey: string) => {
  return httpClient.post<SearchableColumn[]>('/GlobalSearch/GetColumns', { TableKey: tableKey });
};

export const globalSearch = async (req: GlobalSearchRequest) => {
  return httpClient.post<GlobalSearchResponse>('/GlobalSearch/Search', req, {
    preloaderMessage: 'Searching...',
  });
};
