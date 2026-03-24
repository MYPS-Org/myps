import { httpClient } from '../../services/httpClient';
import type { SearchableColumn, CategoryOption } from './Model.d';

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

export const fetchCategory = async () => {
  try {
    const response = await httpClient.post<CategoryOption[]>('/GlobalSearch/GetSearchCategory', {
      preloaderMessage: 'Loading categories...'
    });
    return response;
  } catch (ErrorResponse) {    console.error('Error fetching categories:', ErrorResponse);
    throw ErrorResponse;
  }
}