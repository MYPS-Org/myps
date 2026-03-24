export interface SearchableTable {
  Key: string;
  Label: string;
}

export interface SearchableColumn {
  Field: string;
  Label: string;
}

export interface GlobalSearchRequest {
  Category: string;
  SearchFor: string;
}

export interface CategoryOption {
  Id: number;
  CategoryName: string;
}

export interface GlobalSearchResponse {
  Data: Record<string, unknown>[];
  Title: string;
}
