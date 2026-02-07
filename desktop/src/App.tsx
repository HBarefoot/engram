import { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Preferences from "./pages/Preferences";
import QuickAddModal from "./components/QuickAddModal";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto" />
        <p className="mt-4 text-sm" style={{ color: "rgba(var(--text-secondary), 1)" }}>
          Starting Engram...
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      try {
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

  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/preferences" element={<Preferences />} />
      </Routes>
      {showQuickAdd && (
        <QuickAddModal onClose={() => setShowQuickAdd(false)} />
      )}
    </>
  );
}
