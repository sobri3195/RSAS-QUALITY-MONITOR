import type { ReactNode } from "react";
import { ArrowUpRight, Search, Inbox, Download, Printer } from "lucide-react";
import { labels } from "../features/analytics/analyticsService";
import type { Status } from "../types";
export function Badge({ status }: { status: Status }) {
  return <span className={`badge ${status}`}>{labels[status]}</span>;
}
export function Empty({
  title = "Belum ada data",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={28} />
      </span>
      <h3>{title}</h3>
      <p>
        {children ??
          "Data akan tampil setelah unit memasukkan dan memverifikasi laporan bulanan."}
      </p>
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  children,
  actions,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
export function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        {icon ?? <ArrowUpRight size={18} />}
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="search">
      <Search size={17} />
      <input
        aria-label="Cari indikator"
        placeholder="Cari kode atau nama indikator…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function ExportButtons({ onCSV }: { onCSV: () => void }) {
  return (
    <>
      <button className="button" onClick={onCSV}>
        <Download size={16} />
        Ekspor CSV
      </button>
      <button className="button" onClick={() => window.print()}>
        <Printer size={16} />
        Cetak
      </button>
    </>
  );
}
