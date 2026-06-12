import { useState } from 'react';
import { 
  Server, Database, Brain, Clock, Zap, Cpu, Terminal, Shield, 
  MessageSquare, Settings, Activity, Workflow, GitMerge, Search, Network
} from 'lucide-react';

const hermesData = {
  layers: [
    {
      id: "surfaces",
      title: "Layer 1: Surfaces & Gateways",
      nodes: [
        { id: "cli", label: "CLI / TUI", icon: Terminal, desc: "Local terminal UI. Streaming, slash-command autocomplete, multimodal output." },
        { id: "gateway", label: "Messaging Gateway", icon: MessageSquare, desc: "Bridges Telegram, Discord, Slack, WhatsApp into a single context stream." },
        { id: "acp", label: "ACP Endpoint", icon: Server, desc: "Agent Client Protocol. Allows AI-native editors (like Cursor) to drive the agent." }
      ]
    },
    {
      id: "core",
      title: "Layer 2: The Agent Core (Execution & Learning Loop)",
      nodes: [
        { id: "loop", label: "Agent Loop", icon: Workflow, desc: "The core Think -> Act -> Observe loop. Handles tool calling, multithreading, and error recovery." },
        { id: "eval", label: "Outcome Evaluation", icon: Activity, desc: "Post-execution analysis. Determines if a task succeeded based on explicit/implicit user feedback." },
        { id: "extractor", label: "Skill Extractor", icon: Zap, desc: "When a complex task succeeds, extracts the reasoning pattern into a reusable markdown procedural template." }
      ]
    },
    {
      id: "pillars",
      title: "Layer 3: The 5 Pillars (State & Logic)",
      nodes: [
        { id: "memory", label: "Memory (SQLite FTS5)", icon: Database, desc: "Persistent cross-session memory. user.md (preferences) + memory.md (context). LLM summarized." },
        { id: "skills", label: "Skills Hub", icon: Brain, desc: "Procedural memory. Markdown files the agent creates, edits, and reads to execute repeatable tasks." },
        { id: "soul", label: "SOUL.md", icon: Shield, desc: "Personality and alignment definition. Evolves based on user feedback to prevent tone drift." },
        { id: "crons", label: "Cron Scheduler", icon: Clock, desc: "Background daemon for scheduled, unattended tasks (e.g., nightly syncs, health checks)." }
      ]
    },
    {
      id: "backend",
      title: "Layer 4: Tools & Model Backends",
      nodes: [
        { id: "mcp", label: "MCP Integration", icon: GitMerge, desc: "Model Context Protocol. Connects to external servers/APIs safely without hardcoding tools." },
        { id: "llm", label: "LLM Backend", icon: Cpu, desc: "Model-agnostic routing (Nous Portal, OpenRouter, OpenAI, Local vLLM/Ollama)." }
      ]
    }
  ]
};

const vloopData = {
  layers: [
    {
      id: "userland",
      title: "Layer 1: Dynamic Userland (React)",
      nodes: [
        { id: "react_ui", label: "React Dashboard", icon: Terminal, desc: "Dynamic web UI built with Vite and MUI. Handles user interactions and renders AI-generated code safely inside sandboxed iframes." },
        { id: "comms_flow", label: "HTTP & WebSockets", icon: Network, desc: "Direct communication channel between React and the Python backend. Bypasses the Rust kernel to enforce strict separation of concerns." }
      ]
    },
    {
      id: "cognitive",
      title: "Layer 2: Cognitive Engine (Python)",
      nodes: [
        { id: "dspy_engine", label: "DSPy Base Agent", icon: Brain, desc: "The cognitive brain of the harness. Generates agent pipeline configurations, manages LLM reasoning, and coordinates auto-evaluation loops." },
        { id: "fastapi_server", label: "FastAPI & LiteLLM", icon: Server, desc: "Uvicorn/FastAPI backend serving endpoints. Routes model-agnostic LLM calls to providers (Anthropic, OpenAI, Ollama) via LiteLLM." }
      ]
    },
    {
      id: "gating",
      title: "Layer 3: Security & Policy Gating",
      nodes: [
        { id: "policy_engine", label: "Policy Engine", icon: Settings, desc: "Enforces strict action boundaries via policy.json. Dictates tool access limits, allowed domains, and file system operations." },
        { id: "sql_validator", label: "SQL Validator (sqlglot)", icon: Database, desc: "Parses SQL operations through sqlglot. Permits basic DML queries while permanently blocking destructive DDL queries (e.g., DROP, ALTER)." }
      ]
    },
    {
      id: "kernel",
      title: "Layer 4: Orchestrator Kernel (Rust)",
      nodes: [
        { id: "rust_tauri", label: "Rust / Tauri App", icon: Cpu, desc: "The native orchestration layer. Manages secure boot, process lifecycles, port allocation, health checks, and cross-layer IPC (WebSockets)." },
        { id: "execution_sandbox", label: "Execution Sandbox", icon: Zap, desc: "Isolated runtime environment for agent code. Fully implements execution transport layers via Docker (bollard) or secure SSH (ssh2)." },
        { id: "secure_vault", label: "Secure API Vault", icon: Shield, desc: "Stores and manages sensitive API keys and credentials, exposing them to Python strictly via Rust-managed IPC." }
      ]
    }
  ]
};

export default function App() {
  const [activeTab, setActiveTab] = useState('hermes');
  const [selectedNode, setSelectedNode] = useState<{ id: string; label: string; icon: React.ElementType; desc: string } | null>(null);

  const activeData = activeTab === 'hermes' ? hermesData : vloopData;

  const handleNodeClick = (node: { id: string; label: string; icon: React.ElementType; desc: string }) => {
    setSelectedNode(node);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header & Tabs */}
        <header className="mb-8 border-b border-neutral-800 pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-6 uppercase">Architecture Inspector</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => { setActiveTab('hermes'); setSelectedNode(null); }}
              className={`px-4 py-2 font-mono text-sm font-semibold transition-all ${
                activeTab === 'hermes' 
                  ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                  : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              Hermes Agent (Nous)
            </button>
            <button
              onClick={() => { setActiveTab('vloop'); setSelectedNode(null); }}
              className={`px-4 py-2 font-mono text-sm font-semibold transition-all ${
                activeTab === 'vloop' 
                  ? 'bg-blue-500 text-black shadow-[0_0_15px_rgba(59,130,246,0.3)]' 
                  : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 border border-neutral-800'
              }`}
            >
              psyborgs-git/Vloop-harness
            </button>
          </div>
        </header>



        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Diagram Area */}
          <div className="flex-1 space-y-6">
            {activeData.layers.map((layer, idx) => (
              <div key={layer.id} className="relative">
                {/* Visual Connector Line */}
                {idx !== 0 && (
                  <div className="absolute -top-6 left-1/2 w-px h-6 bg-neutral-800"></div>
                )}
                
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-md">
                  <h2 className="text-xs font-mono text-neutral-500 uppercase tracking-widest mb-4 border-b border-neutral-800 pb-2">
                    {layer.title}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {layer.nodes.map((node) => {
                      const isSelected = selectedNode?.id === node.id;
                      const Icon = node.icon;
                      return (
                        <button
                          key={node.id}
                          onClick={() => handleNodeClick(node)}
                          className={`flex items-start text-left p-4 rounded bg-neutral-950 border transition-all duration-200 group ${
                            isSelected 
                              ? (activeTab === 'hermes' ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]')
                              : 'border-neutral-800 hover:border-neutral-600'
                          }`}
                        >
                          <Icon className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${
                            isSelected 
                              ? (activeTab === 'hermes' ? 'text-emerald-400' : 'text-blue-400')
                              : 'text-neutral-500 group-hover:text-neutral-300'
                          }`} />
                          <div>
                            <div className={`font-mono text-sm font-semibold mb-1 ${
                              isSelected ? 'text-white' : 'text-neutral-300 group-hover:text-white'
                            }`}>
                              {node.label}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Side Inspector Panel */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-md sticky top-6 h-auto min-h-[300px]">
              <div className="flex items-center gap-2 mb-6 border-b border-neutral-800 pb-4">
                <Search className="w-4 h-4 text-neutral-500" />
                <h3 className="font-mono text-sm uppercase tracking-widest text-neutral-400">Node Inspector</h3>
              </div>
              
              {selectedNode ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded bg-neutral-950 border mb-4 ${
                    activeTab === 'hermes' ? 'border-emerald-500/30 text-emerald-400' : 'border-blue-500/30 text-blue-400'
                  }`}>
                    <selectedNode.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{selectedNode.label}</h4>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    {selectedNode.desc}
                  </p>
                  
                  <div className="mt-6 pt-6 border-t border-neutral-800">
                    <div className="text-xs font-mono text-neutral-600 uppercase mb-2">Technical Context</div>
                    <div className="bg-neutral-950 p-3 rounded border border-neutral-800 font-mono text-xs text-neutral-300">
                      {activeTab === 'hermes' 
                        ? `// Target: Hermes Runtime\nStatus: Active Engine\nIntegration: Deep` 
                        : `// Target: Vloop Engine\nStatus: Verified\nIntegration: Repo README`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="w-12 h-12 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center mb-4">
                    <Activity className="w-5 h-5 text-neutral-600" />
                  </div>
                  <p className="text-sm font-mono text-neutral-500">
                    Select a component node from the diagram to inspect its architecture.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}