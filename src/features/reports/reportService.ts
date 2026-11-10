import type { MonthlyRecord } from "../../types";
import { aggregate, interpretation, gap } from "../analytics/analyticsService";
export function reportRows(records: MonthlyRecord[]) {
  return [...new Set(records.map((r) => r.indicatorId))].sort().map((id) => {
    const source = records.filter((r) => r.indicatorId === id);
    const a = aggregate(source);
    return {
      id,
      title: source[0].snapshot.title,
      ...a,
      gap: gap(a.value, a.target),
      interpretation: interpretation(source),
      source,
    };
  });
}
