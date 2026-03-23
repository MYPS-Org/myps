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

export interface GlobalSearchResponse {
  TableKey: string;
  ColumnField: string;
  Value: string;
  Total: number;
  Data: Record<string, unknown>[];
}
