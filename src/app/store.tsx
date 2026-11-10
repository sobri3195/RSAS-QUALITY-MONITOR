import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { AppState, Role } from "../types";
import {
  loadStorage,
  persist,
  auditEvent,
  initialState,
  STORAGE_KEY,
} from "../lib/storageService";
interface Store {
  state: AppState;
  role: Role;
  setRole: (r: Role) => void;
  error: string;
  notice: string;
  notify: (s: string) => void;
  update: (
    fn: (s: AppState) => AppState,
    action: string,
    recordId?: string,
    before?: unknown,
    after?: unknown,
  ) => boolean;
  replace: (s: AppState) => boolean;
  reset: () => boolean;
}
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(() => loadStorage(localStorage));
  const [state, setState] = useState(loaded.state);
  const [error, setError] = useState(loaded.error);
  const [notice, notify] = useState("");
  const [role, setRole] = useState<Role>("Petugas Unit");
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => notify(""), 6000);
    return () => clearTimeout(id);
  }, [notice]);
  function commit(next: AppState, force = false) {
    try {
      if (error && !force) throw Error(error);
      const saved = persist(localStorage, next, state.storageRevision, force);
      setState(saved);
      setError("");
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Penyimpanan gagal.");
      return false;
    }
  }
  function update(
    fn: (s: AppState) => AppState,
    action: string,
    recordId = "",
    before?: unknown,
    after?: unknown,
  ) {
    try {
      const next = fn(state);
      next.audit = [
        ...next.audit,
        auditEvent(recordId, action, before, after, role),
      ];
      return commit(next);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Perubahan tidak valid.");
      return false;
    }
  }
  return (
    <Context.Provider
      value={{
        state,
        role,
        setRole,
        error,
        notice,
        notify,
        update,
        replace: (s) => commit({ ...s, deviceId: state.deviceId }, true),
        reset: () => commit(initialState(), true),
      }}
    >
      {children}
      <div className="toast" role="status" aria-live="polite">
        {notice}
      </div>
      {error && (
        <div className="recovery">
          <strong>Pemulihan data diperlukan</strong>
          <p>{error}</p>
          <button
            onClick={() => {
              const raw = localStorage.getItem(STORAGE_KEY);
              const a = document.createElement("a");
              a.href = URL.createObjectURL(
                new Blob([raw ?? ""], { type: "application/json" }),
              );
              a.download = "rsas-salinan-pemulihan.json";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Unduh salinan mentah
          </button>
          <a href="/transfer">Buka pemulihan / impor</a>
        </div>
      )}
    </Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const s = useContext(Context);
  if (!s) throw Error("Store tidak tersedia");
  return s;
}
