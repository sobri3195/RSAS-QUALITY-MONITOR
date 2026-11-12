import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Profile, WorkflowData, WorkflowRepository } from "./types";
import {
  configurationError,
  productionMode,
  supabase,
  SupabaseRepository,
} from "./supabaseRepository";
import { DemoRepository, demoProfiles } from "./demoRepository";
interface WorkflowContext {
  data: WorkflowData | null;
  profile: Profile | null;
  demo: boolean;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  loadedAt: string;
  repo: WorkflowRepository | null;
  refresh: () => Promise<void>;
  selectDemo: (id: string) => void;
  run: <T>(job: () => Promise<T>, message?: string) => Promise<T | undefined>;
}
const Context = createContext<WorkflowContext | null>(null);
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [demoUser, setDemoUser] = useState(
    () => sessionStorage.getItem("rsas-demo-persona") ?? demoProfiles[0].id,
  );
  const [data, setData] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(configurationError);
  const [notice, setNotice] = useState("");
  const [loadedAt, setLoadedAt] = useState("");
  const sequence = useRef(0);
  const demo = !productionMode;
  const demoProfile =
    demoProfiles.find((p) => p.id === demoUser) ?? demoProfiles[0];
  const repo = useMemo(
    () =>
      demo
        ? new DemoRepository(demoProfile)
        : supabase && userId
          ? new SupabaseRepository(supabase)
          : null,
    [demo, demoProfile, userId],
  );
  const currentRepo = useRef(repo);
  useEffect(() => {
    currentRepo.current = repo;
  }, [repo]);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === "SIGNED_OUT") setData(null);
      setUserId(session?.user.id ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  const refresh = useCallback(async () => {
    if (!repo) return;
    const turn = ++sequence.current;
    try {
      const next = await repo.load();
      if (turn !== sequence.current || currentRepo.current !== repo) return;
      setData(next);
      setError("");
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      if (turn === sequence.current && currentRepo.current === repo)
        setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      if (currentRepo.current === repo) setLoading(false);
    }
  }, [repo]);
  useEffect(() => {
    setData(null);
    setLoading(Boolean(repo));
    void refresh();
    if (!repo) return;
    const unsubscribe = repo.subscribe(() => void refresh());
    const interval = setInterval(() => void refresh(), 30000);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("online", visible);
    };
  }, [repo, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const profile = demo
    ? demoProfile
    : (data?.profiles.find((p) => p.id === userId) ?? null);
  async function run<T>(
    job: () => Promise<T>,
    message = "Perubahan disimpan.",
  ): Promise<T | undefined> {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await job();
      await refresh();
      setNotice(message);
      return result;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Operasi gagal.");
      await refresh();
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return (
    <Context.Provider
      value={{
        data,
        profile,
        demo,
        loading,
        busy,
        error,
        notice,
        loadedAt,
        repo,
        refresh,
        selectDemo: (id) => {
          sessionStorage.setItem("rsas-demo-persona", id);
          setDemoUser(id);
        },
        run,
      }}
    >
      {children}
      <div className="toast" role="status" aria-live="polite">
        {notice}
      </div>
    </Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkflow() {
  const context = useContext(Context);
  if (!context) throw Error("Workflow tidak tersedia.");
  return context;
}
