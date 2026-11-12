import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardPenLine,
  Hospital,
  Building2,
  ChartNoAxesCombined,
  ShieldCheck,
  ListTodo,
  Files,
  SlidersHorizontal,
  ArrowLeftRight,
  CircleHelp,
  ChevronDown,
  CircleDot,
  Filter,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useStore } from "./store";
import { useFilters } from "./filters";
import { roles } from "../types";
import { units } from "../features/indicators/indicatorService";
import { months, labels } from "../features/analytics/analyticsService";
const navigation = [
  ["/", "Dashboard Eksekutif", LayoutDashboard],
  ["/input", "Input Data Unit", ClipboardPenLine],
  ["/hospital", "Indikator Rumah Sakit", Hospital],
  ["/units", "Indikator Unit", Building2],
  ["/analytics", "Analitik & Grafik", ChartNoAxesCombined],
  ["/verification", "Verifikasi Komite Mutu", ShieldCheck],
  ["/actions", "Rencana Tindak Lanjut", ListTodo],
  ["/reports", "Laporan", Files],
  ["/master", "Master Indikator", SlidersHorizontal],
  ["/transfer", "Impor / Ekspor", ArrowLeftRight],
  ["/help", "Pengaturan / Bantuan", CircleHelp],
] as const;
export default function Layout() {
  const { role, setRole } = useStore();
  const { filters: f, setFilters } = useFilters();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <NavLink to="/" className="brand">
          <img
            className="brand-mark"
            src="/logo-rsau.jpeg"
            alt="Logo RSAU Prof. dr. Abdulrachman Saleh"
            width={44}
            height={44}
          />
          <div>
            <b>
              RSAS<span>QUALITY MONITOR</span>
            </b>
          </div>
        </NavLink>
        <div className="sidebar-caption">
          RUANG KERJA MUTU{" "}
          <button
            aria-label="Tutup menu"
            className="mobile-menu"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav>
          {navigation.map(([path, label, Icon], index) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `${isActive ? "active" : ""} ${index === 8 ? "nav-divider" : ""}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {index === 0 && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" /> PENYIMPANAN LOKAL
          <p>
            Data di browser ini,
            <br />
            bukan database bersama.
          </p>
          <div className="sidebar-version">
            RSAS · Edisi 2026 <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            aria-label="Buka menu"
            className="mobile-menu"
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <div className="institution">
            RSAU PROF. DR. ABDULRACHMAN SALEH
            <small>
              Sistem Monitoring, Evaluasi, dan Analisis Indikator Mutu
            </small>
          </div>
          <div className="persona">
            <span className="avatar">
              {role === "Petugas Unit"
                ? "PU"
                : role === "Komite Mutu"
                  ? "KM"
                  : role === "Kepala Unit"
                    ? "KU"
                    : "AP"}
            </span>
            <label>
              Persona lokal
              <select
                aria-label="Persona kerja"
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
              >
                {roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <ChevronDown size={14} />
          </div>
        </header>
        <main>
          <div className="workspace-label">
            <span>
              <CircleDot size={13} /> RSAS QUALITY MONITOR
            </span>
            <small>Data agregat · tanpa identitas pasien</small>
          </div>
          <div className="global-filters no-print">
            <span className="filter-label">
              <Filter size={16} />
              Filter data
            </span>
            <label>
              Tahun
              <input
                aria-label="Tahun filter"
                type="number"
                min="2020"
                max="2100"
                value={f.year}
                onChange={(e) =>
                  setFilters({ ...f, year: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Periode
              <select
                aria-label="Periode filter"
                value={f.period}
                onChange={(e) => setFilters({ ...f, period: e.target.value })}
              >
                <option value="all">Tahunan · semua bulan</option>
                {[1, 2, 3, 4].map((q) => (
                  <option value={`q${q}`} key={`q${q}`}>
                    Triwulan {q}
                  </option>
                ))}
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unit
              <select
                aria-label="Unit filter"
                value={f.unit}
                onChange={(e) => setFilters({ ...f, unit: e.target.value })}
              >
                <option value="all">Semua unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kelompok
              <select
                aria-label="Kelompok filter"
                value={f.kind}
                onChange={(e) => setFilters({ ...f, kind: e.target.value })}
              >
                <option value="all">Semua indikator</option>
                <option value="rumah_sakit">Rumah sakit</option>
                <option value="unit">Unit</option>
              </select>
            </label>
            <label>
              Status
              <select
                aria-label="Status filter"
                value={f.status}
                onChange={(e) => setFilters({ ...f, status: e.target.value })}
              >
                <option value="all">Semua status</option>
                {Object.entries(labels).map(([key, v]) => (
                  <option value={key} key={key}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Jenis data
              <select
                aria-label="Jenis data filter"
                value={f.dataType}
                onChange={(e) =>
                  setFilters({
                    ...f,
                    dataType: e.target.value as typeof f.dataType,
                  })
                }
              >
                <option value="actual">Data aktual</option>
                <option value="simulation">SIMULASI</option>
              </select>
            </label>
          </div>
          {f.dataType === "simulation" && (
            <div className="alert warning">
              MODE SIMULASI — angka latihan terpisah dari laporan aktual dan
              ekspor data unit.
            </div>
          )}
          <div className="alert info no-print">
            Arsip lokal v1 — tidak tersinkronisasi. Verifikasi lokal tidak
            menjadi publikasi resmi.
            <Link className="text-link" to="/pimpinan/dashboard">
              Buka alur Validator → Tim Mutu
            </Link>
          </div>
          <Outlet />
        </main>
        <footer>
          <span>Sagraha Abhipraya Nawasena</span>
          <span>Kesehatan untuk Kedaulatan</span>
        </footer>
      </div>
      <nav className="bottom-nav">
        {[navigation[0], navigation[1], navigation[4], navigation[7]].map(
          ([p, l, I]) => (
            <NavLink to={p} key={p} end={p === "/"}>
              <I size={19} />
              <span>{l}</span>
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}
