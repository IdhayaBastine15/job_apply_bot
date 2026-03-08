"use client";

import { useState, useCallback, useRef } from "react";
import type { AnalysisResult, ResumeSection, TitleSuggestion } from "./api/analyze/route";

type Phase = "input" | "analyzing" | "editor" | "compiling";
type Priority = "high" | "medium" | "low";

const SCORE_DELTA: Record<Priority, number> = { high: 6, medium: 4, low: 2 };

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

// ── LaTeX helpers ─────────────────────────────────────────────────────────────

/** Insert keyword into "Learning Software" row in Technical Skills tabular */
function addKeywordToLatex(latex: string, keyword: string): string {
  // Already has Learning Software row — append to it
  if (/Learning Software\s*&/.test(latex)) {
    return latex.replace(
      /(Learning Software\s*&)([^\\]*)(\\\\(?:\[\dpt\])?)/,
      (_, prefix, content, end) => prefix + content.trimEnd() + ", " + keyword + " " + end
    );
  }

  // Find the Technical Skills section's \end{tabular}
  const skillsStart = latex.search(/\\section\{Technical Skills\}/i);
  if (skillsStart === -1) {
    // Fallback: add before first \end{tabular}
    const tabEnd = latex.indexOf("\\end{tabular}");
    if (tabEnd === -1) return latex;
    return latex.slice(0, tabEnd) + `  Learning Software  & ${keyword} \\\\\n` + latex.slice(tabEnd);
  }
  const tabEnd = latex.indexOf("\\end{tabular}", skillsStart);
  if (tabEnd === -1) return latex;

  return latex.slice(0, tabEnd) + `  Learning Software  & ${keyword} \\\\\n` + latex.slice(tabEnd);
}

// ── Download helpers ──────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Score Gauge ───────────────────────────────────────────────────────────────

function ScoreGauge({ score, breakdown }: { score: number; breakdown?: AnalysisResult["scoreBreakdown"] }) {
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 75 ? "Strong Match" : score >= 50 ? "Moderate Match" : "Weak Match";
  const circumference = 2 * Math.PI * 54;
  const dash = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="130" height="130" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="54" fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="70" cy="70" r="54" fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
        <text x="70" y="65" textAnchor="middle" fontSize="28" fontWeight="700" fill={color}>{score}</text>
        <text x="70" y="83" textAnchor="middle" fontSize="11" fill="#64748b">/ 100</text>
      </svg>
      <span className="px-3 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: color + "20", color }}>
        {label}
      </span>
      {breakdown && (
        <div className="w-full space-y-1.5 mt-1">
          {[
            { label: "Keywords", value: breakdown.keywords, max: 40, color: "#6366f1" },
            { label: "Skills", value: breakdown.skills, max: 30, color: "#0ea5e9" },
            { label: "Experience", value: breakdown.experience, max: 20, color: "#f59e0b" },
            { label: "Structure", value: breakdown.structure, max: 10, color: "#10b981" },
          ].map(({ label: l, value, max, color: c }) => (
            <div key={l} className="flex items-center gap-2">
              <span className="text-xs text-slate-400 w-20 shrink-0">{l}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${(value / max) * 100}%`, backgroundColor: c }} />
              </div>
              <span className="text-xs font-medium text-slate-500 w-10 text-right">{value}/{max}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Permission Modal ──────────────────────────────────────────────────────────

function PermissionModal({
  type, suggestion, titleSuggestion, onAllow, onSkip,
}: {
  type: "suggestion" | "title";
  suggestion?: AnalysisResult["suggestions"][0];
  titleSuggestion?: TitleSuggestion | null;
  onAllow: () => void;
  onSkip: () => void;
}) {
  const current = type === "title" ? titleSuggestion?.current : suggestion?.current;
  const improved = type === "title" ? titleSuggestion?.suggested : suggestion?.improved;
  const description = type === "title" ? titleSuggestion?.reason : suggestion?.description;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onSkip}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Allow AI to change your resume?</h3>
            <p className="text-xs text-slate-500">Review the change before allowing</p>
          </div>
        </div>

        {suggestion?.priority && (
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${PRIORITY_COLOR[suggestion.priority]}`}>
              {suggestion.priority.toUpperCase()}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">
              {type === "title" ? "Title Change" : suggestion.type}
            </span>
          </div>
        )}

        {description && <p className="text-sm text-slate-600 mb-4 leading-relaxed">{description}</p>}

        <div className="space-y-2">
          {current && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <p className="text-xs font-semibold text-red-500 mb-1">Current</p>
              <p className="text-sm text-red-700 leading-relaxed">{current}</p>
            </div>
          )}
          {improved && (
            <div className="rounded-xl bg-green-50 border border-green-100 p-3">
              <p className="text-xs font-semibold text-green-600 mb-1">AI Suggestion</p>
              <p className="text-sm text-green-800 leading-relaxed">{improved}</p>
            </div>
          )}
          {!current && !improved && (
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
              This suggestion will be marked as applied.
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onSkip} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Skip</button>
          <button onClick={onAllow} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>
            Allow Change
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState<Phase>("input");
  const [resume, setResume] = useState<File | null>(null);
  const [latexSource, setLatexSource] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compileNote, setCompileNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor state
  const [resumeSections, setResumeSections] = useState<ResumeSection[]>([]);
  const [liveScore, setLiveScore] = useState(0);
  const [liveBreakdown, setLiveBreakdown] = useState<AnalysisResult["scoreBreakdown"] | undefined>();
  const [titleApplied, setTitleApplied] = useState(false);
  const [appliedIdx, setAppliedIdx] = useState<Set<number>>(new Set());
  const [skippedIdx, setSkippedIdx] = useState<Set<number>>(new Set());
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const [profileApplied, setProfileApplied] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "title" | "suggestion"; index?: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"suggestions" | "keywords" | "weaknesses">("suggestions");

  const handleFile = useCallback((file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) { setError("Please upload a PDF file."); return; }
    setError(null);
    setResume(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const handleAnalyze = async () => {
    if (!resume || !jobDescription.trim()) { setError("Please upload your resume and paste the job description."); return; }
    setError(null); setPhase("analyzing");
    setResult(null); setLiveScore(0); setLiveBreakdown(undefined); setResumeSections([]);
    setTitleApplied(false); setAppliedIdx(new Set()); setSkippedIdx(new Set());
    setAddedKeywords(new Set()); setProfileApplied(false); setPendingAction(null);
    setLatexSource(null); setCompileNote(null);

    try {
      const formData = new FormData();
      formData.append("resume", resume);
      formData.append("jobDescription", jobDescription);
      const res = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Analysis failed."); setPhase("input"); return; }
      setResult(data);
      setLiveScore(data.matchScore);
      setLiveBreakdown(data.scoreBreakdown);
      setResumeSections(data.resumeSections?.length ? data.resumeSections : [{ name: "Resume", content: "" }]);
      // Seed LaTeX source from the server-side template
      if (data.latexTemplate) setLatexSource(data.latexTemplate);
      setActiveTab("suggestions");
      setPhase("editor");
    } catch { setError("Network error. Please check your connection."); setPhase("input"); }
  };

  const applyTextChange = (current: string | undefined, improved: string | undefined) => {
    if (!current || !improved) return;
    setResumeSections((prev) => prev.map((s) => ({
      ...s, content: s.content.includes(current) ? s.content.replace(current, improved) : s.content,
    })));
    if (latexSource?.includes(current)) {
      setLatexSource((prev) => prev?.replace(current, improved) ?? prev);
    }
  };

  const confirmAction = () => {
    if (!pendingAction || !result) return;
    if (pendingAction.type === "title" && result.titleSuggestion) {
      applyTextChange(result.titleSuggestion.current, result.titleSuggestion.suggested);
      setTitleApplied(true);
      setLiveScore((p) => Math.min(100, p + 3));
    } else if (pendingAction.type === "suggestion" && pendingAction.index !== undefined) {
      const s = result.suggestions[pendingAction.index];
      applyTextChange(s.current, s.improved);
      setAppliedIdx((p) => new Set([...p, pendingAction.index!]));
      setLiveScore((p) => Math.min(100, p + (SCORE_DELTA[s.priority] ?? 2)));
    }
    setPendingAction(null);
  };

  const skipAction = () => {
    if (pendingAction?.type === "suggestion" && pendingAction.index !== undefined)
      setSkippedIdx((p) => new Set([...p, pendingAction.index!]));
    setPendingAction(null);
  };

  const addKeyword = (kw: string) => {
    if (addedKeywords.has(kw)) return;

    // Update plain-text sections view
    setResumeSections((prev) => {
      const idx = prev.findIndex((s) => s.name.toLowerCase().includes("skill"));
      if (idx === -1) return prev;
      const updated = [...prev];
      const content = updated[idx].content;
      if (/Learning Software[^\n]*/i.test(content)) {
        updated[idx] = { ...updated[idx], content: content.replace(/(Learning Software[^\n]*)/i, `$1, ${kw}`) };
      } else {
        updated[idx] = { ...updated[idx], content: content.trimEnd() + "\nLearning Software: " + kw };
      }
      return updated;
    });

    // Update LaTeX source with tabular row
    if (latexSource) {
      setLatexSource((prev) => prev ? addKeywordToLatex(prev, kw) : prev);
    }

    setAddedKeywords((p) => new Set([...p, kw]));
    setLiveScore((p) => Math.min(100, p + 2));
  };

  const addAllKeywords = (keywords: string[]) => {
    keywords.filter((kw) => !addedKeywords.has(kw)).forEach((kw) => addKeyword(kw));
  };

  const applyProfileRewrite = () => {
    if (!result?.profileRewrite) return;
    // Update plain-text sections
    setResumeSections((prev) => {
      const idx = prev.findIndex((s) => /profile|summary/i.test(s.name));
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], content: result.profileRewrite! };
      return updated;
    });
    // Replace content in LaTeX template between \section{Profile} and the next section
    setLatexSource((ls) => {
      if (!ls) return ls;
      // Match the paragraph text after \section{Profile}\n\small\n
      return ls.replace(
        /(\\section\{Profile\}[\s\S]*?\\small\s*\n)([\s\S]*?)(\n%)/,
        (_, before, _old, after) => before + result.profileRewrite! + after
      );
    });
    setProfileApplied(true);
    setLiveScore((p) => Math.min(100, p + 5));
  };

  const handleDownload = async () => {
    const baseName = (resume?.name ?? "resume").replace(/\.pdf$/i, "");
    setCompileNote(null);

    if (latexSource) {
      // Compile via server route (local pdflatex → online service → .tex fallback)
      setPhase("compiling");
      try {
        const res = await fetch("/api/compile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latexSource }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setCompileNote("Compilation failed: " + (err.error ?? res.statusText));
          setPhase("editor");
          return;
        }

        const compileFailed = res.headers.get("X-Compile-Failed") === "true";
        const blob = await res.blob();

        if (compileFailed) {
          triggerDownload(blob, `${baseName}_optimized.tex`);
          setCompileNote("PDF compilation unavailable — downloaded .tex instead. Open it at overleaf.com to generate your PDF.");
        } else {
          triggerDownload(blob, `${baseName}_optimized.pdf`);
        }
      } catch (err) {
        setCompileNote("Download failed: " + String(err));
      } finally {
        setPhase("editor");
      }
      return;
    }

    // No LaTeX template — nothing to download
    setCompileNote("No LaTeX template available. Please re-analyse your resume.");
  };

  // ── INPUT PHASE ──────────────────────────────────────────────────────────────
  if (phase === "input") {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">ATS Resume Optimizer</h1>
              <p className="text-xs text-slate-500">2-pass analysis · Groq Llama 3.3 70B</p>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">1</span>
                  Upload Resume
                </h2>
                <p className="text-xs text-slate-400 mb-4 ml-8">PDF only · AI analyses your content, LaTeX template is used for download</p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging ? "border-indigo-400 bg-indigo-50" :
                    resume ? "border-green-400 bg-green-50" :
                    "border-slate-300 hover:border-indigo-300 hover:bg-slate-50"
                  }`}
                >
                  <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  {resume ? (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-xl bg-green-100 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><polyline points="20,6 9,17 4,12" /></svg>
                      </div>
                      <p className="text-sm font-semibold text-green-700">{resume.name}</p>
                      <p className="text-xs text-slate-500">{(resume.size / 1024).toFixed(1)} KB · PDF · Click to change</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17,8 12,3 7,8" /><line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-slate-600">Drop your resume here or click to browse</p>
                      <p className="text-xs text-slate-400">PDF only</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">2</span>
                  Paste Job Description
                </h2>
                <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} rows={12}
                  placeholder="Paste the full job description including requirements, responsibilities and preferred qualifications..."
                  className="w-full resize-none rounded-xl border border-slate-200 p-4 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition" />
                <p className="text-xs text-slate-400 mt-2">{jobDescription.length} characters</p>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

              <button onClick={handleAnalyze}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Analyze &amp; Optimize
              </button>
            </div>

            <div className="flex items-center justify-center">
              <div className="text-center space-y-3 py-16">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-slate-600">Strict 2-pass ATS engine</p>
                <p className="text-sm text-slate-400 max-w-xs">Pass 1 extracts JD requirements. Pass 2 scores your resume against them.</p>
                <div className="mt-6 space-y-2 text-left max-w-xs mx-auto">
                  {[
                    "Required vs preferred skill split",
                    "Weak action verb detection",
                    "Profile/summary AI rewrite",
                    "Missing keywords → Learning Software row",
                    "Compiles LaTeX template → optimized PDF",
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="3"><polyline points="20,6 9,17 4,12" /></svg>
                      </div>
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── ANALYZING PHASE ───────────────────────────────────────────────────────────
  if (phase === "analyzing") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center">
            <svg className="animate-spin h-10 w-10 text-indigo-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-700">Running 2-pass ATS analysis...</p>
          <p className="text-sm text-slate-400">Pass 1: extracting JD requirements · Pass 2: scoring your resume</p>
        </div>
      </div>
    );
  }

  // ── COMPILING PHASE ───────────────────────────────────────────────────────────
  if (phase === "compiling") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center">
            <svg className="animate-spin h-10 w-10 text-violet-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-700">Compiling LaTeX → PDF...</p>
          <p className="text-sm text-slate-400">Applying changes and building your optimized resume</p>
        </div>
      </div>
    );
  }

  // ── EDITOR PHASE ──────────────────────────────────────────────────────────────
  if (phase === "editor" && result) {
    const pendingSuggestion = pendingAction?.type === "suggestion" && pendingAction.index !== undefined
      ? result.suggestions[pendingAction.index] : undefined;
    const pendingCount = result.suggestions.filter((_, i) => !appliedIdx.has(i) && !skippedIdx.has(i)).length;

    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 sticky top-[57px] z-40">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setPhase("input"); setResult(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6" /></svg>
              </button>
              <span className="text-sm font-semibold text-slate-700">ATS Editor</span>
              {resume && <span className="text-xs text-slate-400 hidden sm:block">· {resume.name}</span>}
              {latexSource && <span className="px-2 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-700">LaTeX template loaded</span>}
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{pendingCount} pending</span>
              )}
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                {appliedIdx.size + addedKeywords.size} applied
              </span>
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* LEFT */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Resume Content</h2>
              <p className="text-xs text-slate-400">{latexSource ? "LaTeX template loaded · download compiles to PDF" : "Text preview only"}</p>
            </div>

            {compileNote && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" className="shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">{compileNote}</p>
              </div>
            )}

            {/* Title suggestion */}
            {result.titleSuggestion && !titleApplied && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1.5">Title Suggestion</p>
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-red-600">&ldquo;{result.titleSuggestion.current}&rdquo;</span>
                    {" → "}
                    <span className="font-semibold text-green-700">&ldquo;{result.titleSuggestion.suggested}&rdquo;</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{result.titleSuggestion.reason}</p>
                </div>
                <button onClick={() => setPendingAction({ type: "title" })}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition">Apply</button>
              </div>
            )}
            {result.titleSuggestion && titleApplied && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>
                <p className="text-xs font-medium text-green-700">Title updated to &ldquo;{result.titleSuggestion.suggested}&rdquo;</p>
              </div>
            )}

            {/* Profile rewrite */}
            {result.profileRewrite && !profileApplied && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider">AI Profile Rewrite</p>
                  <button onClick={applyProfileRewrite}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition">Apply</button>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{result.profileRewrite}</p>
              </div>
            )}

            {/* Editable sections */}
            {resumeSections.map((section, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14,2 14,8 20,8" />
                  </svg>
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{section.name}</span>
                </div>
                <div className="p-4">
                  <textarea value={section.content}
                    onChange={(e) => { const v = e.target.value; setResumeSections((p) => p.map((s, j) => j === i ? { ...s, content: v } : s)); }}
                    rows={Math.max(3, Math.ceil(section.content.length / 90))}
                    className="w-full resize-none text-sm text-slate-700 leading-relaxed outline-none focus:bg-indigo-50/40 rounded-lg p-2 -m-2 transition-colors" />
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT */}
          <div className="space-y-4 lg:sticky lg:top-[120px] lg:self-start">
            {/* Score */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">ATS Match Score</h3>
              <ScoreGauge score={liveScore} breakdown={liveBreakdown} />
              <p className="text-xs text-slate-500 leading-relaxed mt-4 pt-3 border-t border-slate-100">{result.summary}</p>
              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                <div><p className="text-lg font-bold text-green-600">{result.skillsAnalysis.matched.length}</p><p className="text-xs text-slate-400">Matched</p></div>
                <div><p className="text-lg font-bold text-red-500">{result.skillsAnalysis.missing.length}</p><p className="text-xs text-slate-400">Missing</p></div>
                <div><p className="text-lg font-bold text-indigo-500">{appliedIdx.size + addedKeywords.size}</p><p className="text-xs text-slate-400">Applied</p></div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-200">
                {(["suggestions", "keywords", "weaknesses"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition ${activeTab === tab ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50" : "text-slate-500 hover:text-slate-700"}`}>
                    {tab === "suggestions" ? `Fixes (${result.suggestions.length})` :
                     tab === "keywords" ? "Keywords" : `Weaknesses (${result.weakBullets?.length ?? 0})`}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
                {/* Suggestions tab */}
                {activeTab === "suggestions" && result.suggestions.map((s, i) => {
                  const isApplied = appliedIdx.has(i), isSkipped = skippedIdx.has(i);
                  return (
                    <div key={i} className={`rounded-xl border p-3.5 space-y-2 transition-opacity ${isApplied ? "bg-green-50 border-green-200 opacity-60" : isSkipped ? "bg-slate-50 border-slate-100 opacity-40" : "bg-white border-slate-200"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${PRIORITY_COLOR[s.priority]}`}>{s.priority.toUpperCase()}</span>
                          <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 capitalize">{s.type}</span>
                        </div>
                        {isApplied ? (
                          <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>Applied
                          </span>
                        ) : isSkipped ? <span className="text-xs text-slate-400">Skipped</span> : (
                          <button onClick={() => setPendingAction({ type: "suggestion", index: i })}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition">Apply</button>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
                    </div>
                  );
                })}

                {/* Keywords tab */}
                {activeTab === "keywords" && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Found ({result.foundKeywords.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.foundKeywords.map((kw) => (
                          <span key={kw} className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">✓ {kw}</span>
                        ))}
                      </div>
                    </div>

                    {result.requiredMissing?.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Required Missing ({result.requiredMissing.length})</p>
                          <button onClick={() => addAllKeywords(result.requiredMissing)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">+ Add all to Skills</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {result.requiredMissing.map((kw) => {
                            const isAdded = addedKeywords.has(kw);
                            return (
                              <button key={kw} onClick={() => !isAdded && addKeyword(kw)}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium border transition ${isAdded ? "bg-green-50 text-green-700 border-green-200 cursor-default" : "bg-red-50 text-red-700 border-red-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 cursor-pointer"}`}>
                                {isAdded ? "✓" : "+"} {kw}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {result.preferredMissing?.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Preferred Missing ({result.preferredMissing.length})</p>
                          <button onClick={() => addAllKeywords(result.preferredMissing)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">+ Add all</button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {result.preferredMissing.map((kw) => {
                            const isAdded = addedKeywords.has(kw);
                            return (
                              <button key={kw} onClick={() => !isAdded && addKeyword(kw)}
                                className={`px-2 py-0.5 rounded-full text-xs font-medium border transition ${isAdded ? "bg-green-50 text-green-700 border-green-200 cursor-default" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 cursor-pointer"}`}>
                                {isAdded ? "✓" : "+"} {kw}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-slate-400">Click a keyword to add it as a new &ldquo;Learning Software&rdquo; row in your Skills section</p>
                  </div>
                )}

                {/* Weaknesses tab */}
                {activeTab === "weaknesses" && (
                  <div className="space-y-3">
                    {(!result.weakBullets || result.weakBullets.length === 0) ? (
                      <div className="text-center py-8">
                        <p className="text-sm font-semibold text-green-600">No weak bullets found!</p>
                        <p className="text-xs text-slate-400 mt-1">All your bullets use strong action verbs and metrics.</p>
                      </div>
                    ) : result.weakBullets.map((wb, i) => (
                      <div key={i} className="rounded-xl bg-amber-50 border border-amber-200 p-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-2 ${wb.issue.toLowerCase().includes("verb") ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {wb.issue.toLowerCase().includes("verb") ? "Weak Verb" : "No Metric"}
                        </span>
                        <p className="text-xs text-slate-700 leading-relaxed">{wb.original}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {pendingAction && (
          <PermissionModal type={pendingAction.type} suggestion={pendingSuggestion}
            titleSuggestion={result.titleSuggestion} onAllow={confirmAction} onSkip={skipAction} />
        )}
      </div>
    );
  }

  return null;
}
