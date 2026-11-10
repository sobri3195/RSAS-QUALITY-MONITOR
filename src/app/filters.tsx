import { createContext, useContext, useState, type ReactNode } from "react";
import type { MonthlyRecord, Indicator } from "../types";
export interface Filters {
  year: number;
  period: string;
  unit: string;
  kind: string;
  status: string;
  dataType: "actual" | "simulation";
}
const FilterContext = createContext<{
  filters: Filters;
  setFilters: (f: Filters) => void;
} | null>(null);
export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>({
    year: 2026,
    period: "all",
    unit: "all",
    kind: "all",
    status: "all",
    dataType: "actual",
  });
  return (
    <FilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </FilterContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useFilters() {
  return useContext(FilterContext)!;
}
// eslint-disable-next-line react-refresh/only-export-components
export function periodMonths(period: string) {
  return period === "all"
    ? Array.from({ length: 12 }, (_, i) => i + 1)
    : period.startsWith("q")
      ? Array.from({ length: 3 }, (_, i) => (Number(period[1]) - 1) * 3 + i + 1)
      : [Number(period)];
}
// eslint-disable-next-line react-refresh/only-export-components
export function matches(r: MonthlyRecord, f: Filters) {
  return (
    r.year === f.year &&
    periodMonths(f.period).includes(r.month) &&
    (f.unit === "all" || r.unitId === f.unit) &&
    (f.kind === "all" || r.snapshot.kind === f.kind) &&
    r.dataType === f.dataType
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function indicatorMatches(i: Indicator, f: Filters) {
  return (
    (f.kind === "all" || i.kind === f.kind) &&
    (f.unit === "all" || i.kind === "rumah_sakit" || i.unitId === f.unit)
  );
}
