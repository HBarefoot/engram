import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { initApiPort } from "./lib/api";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import Memories from "./pages/Memories";
import Search from "./pages/Search";
import Agents from "./pages/Agents";
import Statistics from "./pages/Statistics";
import Health from "./pages/Health";
import Contradictions from "./pages/Contradictions";
import Import from "./pages/Import";
import Onboarding from "./pages/Onboarding";
import Preferences from "./pages/Preferences";
import QuickAddModal from "./components/QuickAddModal";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
        <p className="mt-4 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Starting Engram...
        </p>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function init() {
      try {
        await initApiPort();
        const isFirstRun = await invoke<boolean>("check_first_run");
        if (isFirstRun) {
          navigate("/onboarding");
        }
      } catch {
        // Tauri commands not available (dev mode without Tauri) -- continue to dashboard
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [navigate]);

  useEffect(() => {
    const unlisten: Array<() => void> = [];

    listen("open-quick-add", () => {
      setShowQuickAdd(true);
    }).then((fn) => unlisten.push(fn));

    listen("open-preferences", () => {
      navigate("/preferences");
    }).then((fn) => unlisten.push(fn));

    listen<string>("navigate", (event) => {
      const path = event.payload;
      if (path === "/dashboard") {
        navigate("/");
      } else {
        navigate(path);
      }
    }).then((fn) => unlisten.push(fn));

    return () => {
      unlisten.forEach((fn) => fn());
    };
  }, [navigate]);

  if (loading) {
    return <LoadingScreen />;
  }

  // Onboarding gets its own full-screen layout (no sidebar)
  if (location.pathname === "/onboarding") {
    return (
      <>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
        </Routes>
        {showQuickAdd && (
          <QuickAddModal onClose={() => setShowQuickAdd(false)} />
        )}
      </>
    );
  }

  return (
    <>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/memories" element={<Memories />} />
          <Route path="/search" element={<Search />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/health" element={<Health />} />
          <Route path="/contradictions" element={<Contradictions />} />
          <Route path="/import" element={<Import />} />
          <Route path="/preferences" element={<Preferences />} />
          <Route path="/onboarding" element={<Onboarding />} />
        </Routes>
      </AppLayout>
      {showQuickAdd && (
        <QuickAddModal onClose={() => setShowQuickAdd(false)} />
      )}
    </>
  );
}
