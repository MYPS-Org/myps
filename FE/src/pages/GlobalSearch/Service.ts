import { httpClient } from '../../services/httpClient';
import type { SearchableColumn } from './Model.d';

export const getSearchColumns = async (tableKey: string) => {
  return httpClient.post<SearchableColumn[]>('/GlobalSearch/GetColumns', { TableKey: tableKey });
};

export const globalSearch = async (Category: string, SearchFor: string) => {
  try {
    const response = await httpClient.post('/GlobalSearch/Search', { Category, SearchFor }, {
      preloaderMessage: 'Searching...'
    });
    return response;
  } catch (ErrorResponse) {
    console.error('Error performing global search:', ErrorResponse);
    throw ErrorResponse;
  }
};