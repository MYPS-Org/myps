export {};
declare global {
  interface String {
    StringToDate(): string;
  }
  interface Number {
    FormatToCurrency(): string;
  }

  interface NumberConstructor {
    parseNumberInput(value: string, fallback?: number | null): number | null;
  }
  
}
