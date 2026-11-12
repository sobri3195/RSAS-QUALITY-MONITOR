import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardPenLine,
  ShieldCheck,
  Inbox,
  ChartNoAxesCombined,
  ListTodo,
  Files,
  SlidersHorizontal,
  Users,
  History,
  Settings,
  Menu,
  X,
  LogOut,
  RefreshCw,
  Bell,
} from "lucide-react";
import {
  useWorkflow,
  WorkflowProvider,
} from "../../features/workflow/WorkflowProvider";
import { demoProfiles } from "../../features/workflow/demoRepository";
import { roleNames, type WorkflowRole } from "../../features/workflow/types";
import { supabase } from "../../features/workflow/supabaseRepository";
const navigation: [string, string, typeof Inbox, WorkflowRole[]][] = [
  [
    "/pimpinan/dashboard",
    "Dashboard",
    LayoutDashboard,
    ["admin", "unit", "validator", "mutu", "leader"],
  ],
  ["/unit/input", "Input Data", ClipboardPenLine, ["unit"]],
  ["/unit/submissions", "Pengajuan Saya", Files, ["unit"]],
  ["/validator", "Validasi", ShieldCheck, ["validator"]],
  ["/mutu/inbox", "Inbox Mutu", Inbox, ["mutu"]],
  [
    "/mutu/analytics",
    "Analisis Tren",
    ChartNoAxesCombined,
    ["admin", "mutu", "leader"],
  ],
  [
    "/workflow/actions",
    "Rencana Tindak Lanjut",
    ListTodo,
    ["unit", "mutu", "leader", "admin"],
  ],
  [
    "/workflow/reports",
    "Laporan",
    Files,
    ["admin", "unit", "validator", "mutu", "leader"],
  ],
  [
    "/workflow/master",
    "Master Indikator",
    SlidersHorizontal,
    ["admin", "unit", "validator", "mutu", "leader"],
  ],
  ["/workflow/users", "Manajemen User", Users, ["admin"]],
  [
    "/workflow/audit",
    "Audit Trail",
    History,
    ["admin", "unit", "validator", "mutu", "leader"],
  ],
  [
    "/workflow/settings",
    "Pengaturan",
    Settings,
    ["admin", "unit", "validator", "mutu", "leader"],
  ],
];
export default function WorkflowLayout() {
  return (
    <WorkflowProvider>
      <Shell />
    </WorkflowProvider>
  );
}
function Shell() {
  const {
    data,
    profile,
    demo,
    selectDemo,
    loading,
    error,
    loadedAt,
    refresh,
    run,
    repo,
  } = useWorkflow();
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const location = useLocation();
  const page = navigation.find((n) => n[0] === location.pathname);
  const forbidden = profile && page && !page[3].includes(profile.role);
  if (!demo && !profile)
    return (
      <div className="workflow-login">
        <img src="/logo-rsau.jpeg" width="64" alt="Logo RSAU" />
        <h1>RSAS Quality Monitor</h1>
        <p>Masuk ke ruang kerja resmi rumah sakit.</p>
        {error && (
          <p role="alert" className="alert warning">
            {error}
          </p>
        )}
        {loading ? (
          <p>Memuat sesi…</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!supabase) return;
              setLoginError("");
              const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              setPassword("");
              if (error)
                setLoginError(
                  "Email atau kata sandi tidak sesuai, atau akun belum tersedia.",
                );
            }}
          >
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Kata sandi
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="button primary" disabled={!supabase}>
              Masuk
            </button>
            {loginError && <p role="alert">{loginError}</p>}
          </form>
        )}
        <Link to="/help">Bantuan & arsip lokal</Link>
      </div>
    );
  if (!profile) return <p>Memuat akun…</p>;
  return (
    <div className="app-shell workflow-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" to="/pimpinan/dashboard">
          <img
            className="brand-mark"
            src="/logo-rsau.jpeg"
            width="44"
            height="44"
            alt="Logo RSAU"
          />
          <b>
            RSAS<span>QUALITY MONITOR</span>
          </b>
        </Link>
        <div className="sidebar-caption">
          RUANG KERJA {demo ? "DEMO" : "RESMI"}
          <button
            className="mobile-menu"
            aria-label="Tutup menu workflow"
            onClick={() => setMenu(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav>
          {navigation
            .filter((n) => n[3].includes(profile.role))
            .map(([path, label, Icon]) => (
              <NavLink to={path} key={path} onClick={() => setMenu(false)}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <b>{demo ? "DEMO · DATA SINTETIS" : "SUMBER DATA SUPABASE"}</b>
          <p>
            {demo
              ? "Hanya browser ini. Tidak tersinkronisasi."
              : "Akses sesuai akun dan penugasan."}
          </p>
          <Link to="/legacy">Buka arsip lokal v1</Link>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            aria-label="Buka menu workflow"
            className="mobile-menu"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="institution">
            RSAU PROF. DR. ABDULRACHMAN SALEH
            <small>Monitoring · Validasi · Publikasi Mutu</small>
          </div>
          <div className="persona">
            {demo ? (
              <label>
                Persona DEMO
                <select
                  aria-label="Persona DEMO"
                  value={profile.id}
                  onChange={(e) => selectDemo(e.target.value)}
                >
                  {demoProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {roleNames[p.role]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span>
                {profile.display_name}
                <small>{roleNames[profile.role]}</small>
              </span>
            )}
            <button
              className="button"
              aria-label="Notifikasi"
              onClick={() => setNotifications(!notifications)}
            >
              <Bell size={17} />
              {data?.notifications.filter((n) => !n.read_at).length ?? 0}
            </button>
            {!demo && (
              <button
                aria-label="Keluar"
                onClick={() => void supabase?.auth.signOut()}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        <main>
          <div className="workspace-label">
            <span>RSAS / {page?.[1] ?? "Detail pengajuan"}</span>
            <button className="text-link" onClick={() => void refresh()}>
              <RefreshCw size={13} /> Muat ulang
            </button>
          </div>
          {demo && (
            <div className="alert warning" role="note">
              <strong>DEMO MODE — DATA SINTETIS.</strong> Latihan di browser
              ini; tidak tersinkronisasi dan bukan laporan resmi rumah sakit.
            </div>
          )}
          {!demo && (
            <div className="workflow-sync">
              Sumber: Supabase · Terakhir dimuat{" "}
              {loadedAt ? new Date(loadedAt).toLocaleString("id-ID") : "—"}.
              Pembaruan melalui Realtime dan pemeriksaan ulang setiap 30 detik.
            </div>
          )}
          {error && (
            <div className="alert warning" role="alert">
              Gagal memperbarui data: {error}. Periksa koneksi, lalu muat ulang.
            </div>
          )}
          {!profile.active ? (
            <div className="empty">
              <h1>Akun menunggu aktivasi Admin</h1>
              <p>Admin harus menentukan role dan penugasan unit.</p>
            </div>
          ) : forbidden ? (
            <div className="empty">
              <h1>Akses halaman ditolak</h1>
              <p>Halaman ini tidak sesuai role akun Anda.</p>
            </div>
          ) : loading ? (
            <div className="empty">Memuat data…</div>
          ) : data ? (
            <Outlet />
          ) : (
            <p>Data belum tersedia. Coba muat ulang.</p>
          )}
          {notifications && (
            <section className="panel workflow-notifications">
              <div className="panel-head">
                <h2>Notifikasi</h2>
                <button onClick={() => setNotifications(false)}>Tutup</button>
              </div>
              {data?.notifications.length ? (
                data.notifications.map((n) => (
                  <div key={n.id} className="workflow-notification">
                    <Link
                      to={n.target_url}
                      onClick={() => {
                        void run(
                          () => repo!.markRead(n.id),
                          "Notifikasi dibaca.",
                        );
                        setNotifications(false);
                      }}
                    >
                      <b>
                        {!n.read_at ? "● " : ""}
                        {n.message}
                      </b>
                      <small>
                        {new Date(n.created_at).toLocaleString("id-ID")}
                      </small>
                    </Link>
                  </div>
                ))
              ) : (
                <p className="form-content">Tidak ada notifikasi.</p>
              )}
            </section>
          )}
        </main>
        <footer>
          <span>Sagraha Abhipraya Nawasena</span>
          <span>Kesehatan untuk Kedaulatan</span>
        </footer>
      </div>
    </div>
  );
}
