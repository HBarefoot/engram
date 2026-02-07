import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";

interface DetectedAgent {
  id: string;
  name: string;
  configPath: string;
  connected: boolean;
  available: boolean;
}

const STEPS = ["welcome", "agents", "seed", "complete"] as const;
type Step = (typeof STEPS)[number];

export default function Onboarding() {
  const [step, setStep] = useState<Step>("welcome");
  const [agents, setAgents] = useState<DetectedAgent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [seedOptions, setSeedOptions] = useState({
    claudeFiles: true,
    gitConfig: true,
    packageJson: false,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  useEffect(() => {
    if (step === "agents") {
      loadAgents();
    }
  }, [step]);

  async function loadAgents() {
    setLoading(true);
    try {
      const detected = await invoke<DetectedAgent[]>("get_detected_agents");
      setAgents(detected);
      const autoSelected = new Set(
        detected.filter((a) => a.available).map((a) => a.id)
      );
      setSelectedAgents(autoSelected);
    } catch {
      setAgents([
        { id: "claude-code", name: "Claude Code", available: false, connected: false, configPath: "~/.claude/mcp.json" },
        { id: "claude-desktop", name: "Claude Desktop", available: false, connected: false, configPath: "~/Library/Application Support/Claude/claude_desktop_config.json" },
        { id: "cursor", name: "Cursor", available: false, connected: false, configPath: "~/.cursor/mcp.json" },
        { id: "windsurf", name: "Windsurf", available: false, connected: false, configPath: "~/.windsurf/mcp.json" },
        { id: "chatgpt", name: "ChatGPT", available: false, connected: false, configPath: "Settings > MCP Servers (in-app)" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleAgent(id: string) {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleComplete() {
    try {
      await invoke("complete_onboarding", {
        agents: Array.from(selectedAgents),
        seedOptions,
      });
    } catch {
      // Continue even if Tauri invoke fails
    }
    navigate("/");
  }

  function goNext() {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    }
  }

  function goBack() {
    const prevIndex = stepIndex - 1;
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex]);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-700">
        <motion.div
          className="h-full bg-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {step === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-6"
              >
                <img src="/engram-logo.png" alt="Engram" className="h-24 w-24 rounded-2xl mx-auto" />
                <h1 className="text-3xl font-bold">Welcome to Engram</h1>
                <p
                  className="text-lg"
                  style={{ color: "rgba(var(--text-secondary), 1)" }}
                >
                  Persistent memory for your AI agents. Engram gives every agent
                  you use the ability to remember what matters about how you
                  work.
                </p>
                <p
                  className="text-sm"
                  style={{ color: "rgba(var(--text-secondary), 1)" }}
                >
                  Let's get you set up in a few quick steps.
                </p>
              </motion.div>
            )}

            {step === "agents" && (
              <motion.div
                key="agents"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold">Detect Your Agents</h2>
                  <p
                    className="mt-2 text-sm"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    We found these AI agents on your machine. Select which ones
                    to connect to Engram.
                  </p>
                </div>

                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agents.map((agent) => (
                      <label
                        key={agent.id}
                        className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAgents.has(agent.id)}
                          onChange={() => toggleAgent(agent.id)}
                          className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{agent.name}</span>
                            {agent.available && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                Detected
                              </span>
                            )}
                            {agent.connected && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                Connected
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs mt-0.5 font-mono"
                            style={{
                              color: "rgba(var(--text-secondary), 1)",
                            }}
                          >
                            {agent.configPath}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {step === "seed" && (
              <motion.div
                key="seed"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold">Seed Your Memory</h2>
                  <p
                    className="mt-2 text-sm"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    Optionally import some initial context so Engram knows a bit
                    about your setup.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={seedOptions.claudeFiles}
                      onChange={(e) =>
                        setSeedOptions((prev) => ({
                          ...prev,
                          claudeFiles: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <div className="ml-3">
                      <span className="font-medium">CLAUDE.md files</span>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "rgba(var(--text-secondary), 1)" }}
                      >
                        Import project instructions and preferences from
                        CLAUDE.md
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={seedOptions.gitConfig}
                      onChange={(e) =>
                        setSeedOptions((prev) => ({
                          ...prev,
                          gitConfig: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <div className="ml-3">
                      <span className="font-medium">Git config</span>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "rgba(var(--text-secondary), 1)" }}
                      >
                        Import your name, email, and preferred settings from
                        .gitconfig
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={seedOptions.packageJson}
                      onChange={(e) =>
                        setSeedOptions((prev) => ({
                          ...prev,
                          packageJson: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <div className="ml-3">
                      <span className="font-medium">package.json</span>
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "rgba(var(--text-secondary), 1)" }}
                      >
                        Import project tech stack info from current directory's
                        package.json
                      </p>
                    </div>
                  </label>
                </div>
              </motion.div>
            )}

            {step === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-center space-y-6"
              >
                <div className="text-6xl">🎉</div>
                <h2 className="text-2xl font-bold">You're All Set!</h2>
                <p
                  className="text-sm"
                  style={{ color: "rgba(var(--text-secondary), 1)" }}
                >
                  Engram is running in the background. Your AI agents will now
                  build up memory as you work together. Use the quick-add
                  shortcut to save memories anytime.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <kbd className="px-2 py-1 text-xs font-mono rounded bg-gray-200 dark:bg-gray-700">
                    Cmd
                  </kbd>
                  <span className="text-xs">+</span>
                  <kbd className="px-2 py-1 text-xs font-mono rounded bg-gray-200 dark:bg-gray-700">
                    Shift
                  </kbd>
                  <span className="text-xs">+</span>
                  <kbd className="px-2 py-1 text-xs font-mono rounded bg-gray-200 dark:bg-gray-700">
                    M
                  </kbd>
                  <span
                    className="text-xs ml-2"
                    style={{ color: "rgba(var(--text-secondary), 1)" }}
                  >
                    Quick Add Memory
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6 flex justify-between">
        <button
          onClick={goBack}
          disabled={stepIndex === 0}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Back
        </button>

        {step === "complete" ? (
          <button
            onClick={handleComplete}
            className="px-6 py-2 text-sm font-medium text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Get Started
          </button>
        ) : (
          <button
            onClick={goNext}
            className="px-6 py-2 text-sm font-medium text-white rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
