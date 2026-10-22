// Campos del importador (sin dependencias: se usan también en el cliente).
export const FIELDS = ["date", "amount", "concept", "vendor", "category"] as const;
export type Field = (typeof FIELDS)[number];
export type ColumnMapping = Partial<Record<Field, number>>;

export const FIELD_LABELS: Record<Field, string> = {
  date: "Fecha",
  amount: "Monto",
  concept: "Concepto",
  vendor: "Tienda",
  category: "Categoría",
};
