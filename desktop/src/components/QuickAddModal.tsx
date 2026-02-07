import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getApiBase } from "../lib/api";

interface QuickAddModalProps {
  onClose: () => void;
}

const CATEGORIES = [
  { value: "preference", label: "Preference" },
  { value: "fact", label: "Fact" },
  { value: "pattern", label: "Pattern" },
  { value: "decision", label: "Decision" },
  { value: "outcome", label: "Outcome" },
] as const;

export default function QuickAddModal({ onClose }: QuickAddModalProps) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("fact");
  const [entity, setEntity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSave() {
    if (!content.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const body: Record<string, string> = {
        content: content.trim(),
        category,
      };
      if (entity.trim()) {
        body.entity = entity.trim();
      }

      const res = await fetch(`${getApiBase()}/memories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save memory");
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save memory");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
        style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.4)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-lg rounded-xl shadow-2xl overflow-hidden"
          style={{ backgroundColor: "rgba(var(--surface-raised), 1)" }}
        >
          <div className="p-4 space-y-3">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What should Engram remember?"
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              style={{ color: "rgba(var(--text-primary), 1)" }}
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ color: "rgba(var(--text-primary), 1)" }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  placeholder="Entity (optional)"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ color: "rgba(var(--text-primary), 1)" }}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <span
                className="text-xs"
                style={{ color: "rgba(var(--text-secondary), 1)" }}
              >
                <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-gray-200 dark:bg-gray-700">
                  Cmd+Enter
                </kbd>{" "}
                to save &middot;{" "}
                <kbd className="px-1.5 py-0.5 text-xs font-mono rounded bg-gray-200 dark:bg-gray-700">
                  Esc
                </kbd>{" "}
                to close
              </span>
              <button
                onClick={handleSave}
                disabled={saving || !content.trim()}
                className="px-4 py-1.5 text-sm font-medium text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
