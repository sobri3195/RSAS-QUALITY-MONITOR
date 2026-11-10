import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
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
export default function App() {
  return (
    <StoreProvider>
      <FilterProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
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
        </BrowserRouter>
      </FilterProvider>
    </StoreProvider>
  );
}
