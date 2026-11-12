import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { StoreProvider } from "./store";
import { FilterProvider } from "./filters";
import Layout from "./Layout";
import Dashboard from "../pages/Dashboard";
import Input from "../pages/Input";
import Monitoring from "../pages/Monitoring";
import Master, { IndicatorDetail } from "../pages/Master";
import Verification from "../pages/Verification";
import Actions from "../pages/Actions";
import Reports from "../pages/Reports";
import Transfer from "../pages/Transfer";
import Help from "../pages/Help";
const WorkflowLayout = lazy(() => import("../pages/workflow/WorkflowLayout"));
const Analytics = lazy(() => import("../pages/workflow/Analytics"));
const SubmissionInput = lazy(() =>
  import("../pages/workflow/SubmissionPages").then((m) => ({
    default: m.SubmissionInput,
  })),
);
const SubmissionList = lazy(() =>
  import("../pages/workflow/SubmissionPages").then((m) => ({
    default: m.SubmissionList,
  })),
);
const SubmissionDetail = lazy(() =>
  import("../pages/workflow/SubmissionPages").then((m) => ({
    default: m.SubmissionDetail,
  })),
);
const WorkflowMaster = lazy(() =>
  import("../pages/workflow/AdminPages").then((m) => ({
    default: m.WorkflowMaster,
  })),
);
const UserManagement = lazy(() =>
  import("../pages/workflow/AdminPages").then((m) => ({
    default: m.UserManagement,
  })),
);
const WorkflowActions = lazy(() =>
  import("../pages/workflow/SupportPages").then((m) => ({
    default: m.WorkflowActions,
  })),
);
const WorkflowAudit = lazy(() =>
  import("../pages/workflow/SupportPages").then((m) => ({
    default: m.WorkflowAudit,
  })),
);
const WorkflowSettings = lazy(() =>
  import("../pages/workflow/SupportPages").then((m) => ({
    default: m.WorkflowSettings,
  })),
);
import { productionMode } from "../features/workflow/supabaseRepository";
function LegacyLayout() {
  return (
    <StoreProvider>
      <FilterProvider>
        <Layout />
      </FilterProvider>
    </StoreProvider>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="empty">Memuat ruang kerja…</div>}>
        <Routes>
          <Route element={<WorkflowLayout />}>
            <Route path="unit/input" element={<SubmissionInput />} />
            <Route path="unit/submissions" element={<SubmissionList />} />
            <Route
              path="validator"
              element={<SubmissionList kind="validator" />}
            />
            <Route path="mutu/inbox" element={<SubmissionList kind="mutu" />} />
            <Route path="mutu/analytics" element={<Analytics />} />
            <Route path="pimpinan/dashboard" element={<Analytics />} />
            <Route path="workflow/reports" element={<Analytics report />} />
            <Route
              path="workflow/submissions/:id"
              element={<SubmissionDetail />}
            />
            <Route path="workflow/actions" element={<WorkflowActions />} />
            <Route path="workflow/master" element={<WorkflowMaster />} />
            <Route path="workflow/users" element={<UserManagement />} />
            <Route path="workflow/audit" element={<WorkflowAudit />} />
            <Route path="workflow/settings" element={<WorkflowSettings />} />
          </Route>
          <Route element={<LegacyLayout />}>
            <Route
              index
              element={
                productionMode ? (
                  <Navigate to="/pimpinan/dashboard" replace />
                ) : (
                  <Dashboard />
                )
              }
            />
            <Route path="legacy" element={<Dashboard />} />
            <Route path="input" element={<Input />} />
            <Route
              path="hospital"
              element={<Monitoring kind="rumah_sakit" />}
            />
            <Route path="units" element={<Monitoring kind="unit" />} />
            <Route path="analytics" element={<Dashboard analytics />} />
            <Route path="verification" element={<Verification />} />
            <Route path="actions" element={<Actions />} />
            <Route path="reports" element={<Reports />} />
            <Route path="master" element={<Master />} />
            <Route path="indicator/:id" element={<IndicatorDetail />} />
            <Route path="transfer" element={<Transfer />} />
            <Route path="help" element={<Help />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Halaman tidak ditemukan</h1>
                  <Link to="/">Kembali ke dashboard</Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
