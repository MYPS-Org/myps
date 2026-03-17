export interface SearchableTable {
  Key: string;
  Label: string;
}

export interface SearchableColumn {
  Field: string;
  Label: string;
}

export interface GlobalSearchRequest {
  TableKey: string;
  ColumnField: string;
  Value: string;
}

export interface GlobalSearchResponse {
  TableKey: string;
  ColumnField: string;
  Value: string;
  Total: number;
  Data: Record<string, unknown>[];
}
