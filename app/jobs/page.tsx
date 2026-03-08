"use client";

import { useEffect, useState } from "react";

type JobStatus = "no_reply" | "applied" | "interview" | "offer" | "rejected";

interface SavedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string | null;
  link: string | null;
  contact: string | null;
  salary: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  savedAt: string;
  updatedAt: string;
}

const STATUSES: { key: JobStatus; label: string; color: string; dot: string }[] = [
  { key: "no_reply", label: "Saved", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  { key: "applied", label: "Applied", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  { key: "interview", label: "In Interview", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  { key: "offer", label: "Selected", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-400" },
];

function statusMeta(s: string) {
  return STATUSES.find((x) => x.key === s) ?? STATUSES[0];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

export default function JobTrackerPage() {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<JobStatus | "all">("all");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchJobs = async () => {
    const res = await fetch("/api/jobs");
    if (res.ok) setJobs(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const saveNotes = async (id: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, notes: notesText } : j)));
    setEditingNotes(null);
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesText }),
    });
  };

  const deleteJob = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/jobs/${id}`, { method: "DELETE" });
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setDeletingId(null);
  };

  const filtered =
    activeTab === "all" ? jobs : jobs.filter((j) => j.status === activeTab);

  // Stats
  const stats = STATUSES.map((s) => ({
    ...s,
    count: jobs.filter((j) => j.status === s.key).length,
  }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Job Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">
            {jobs.length} saved · Track your applications in one place
          </p>
        </div>
        <a
          href="/search"
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Find More Jobs
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3 mb-7">
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={`rounded-xl border p-4 text-center transition ${
              activeTab === s.key ? s.color + " shadow-sm" : "bg-white border-slate-200 hover:border-indigo-200"
            }`}
          >
            <div className="text-2xl font-bold text-slate-800">{s.count}</div>
            <div className="text-xs font-medium text-slate-500 mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Tab filter */}
      <div className="flex items-center gap-1 mb-5 bg-white rounded-xl border border-slate-200 p-1 w-fit">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
            activeTab === "all"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All ({jobs.length})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              activeTab === s.key
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-slate-400">
          <svg className="animate-spin h-8 w-8 mx-auto mb-3 text-indigo-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading your saved jobs...
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">No jobs {activeTab !== "all" ? `with status "${statusMeta(activeTab).label}"` : "saved yet"}</p>
          <p className="text-slate-400 text-sm mt-1">
            {activeTab === "all"
              ? "Go to Find Jobs and click \"+ Track\" to save a job here."
              : "Change the tab or update a job's status."}
          </p>
        </div>
      )}

      {/* Job list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((job) => {
            const meta = statusMeta(job.status);
            const isExpanded = expandedId === job.id;
            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Main row */}
                <div className="p-5 flex items-start gap-4">
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">
                          {job.link ? (
                            <a
                              href={job.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-indigo-600 transition"
                            >
                              {job.title} ↗
                            </a>
                          ) : (
                            job.title
                          )}
                        </h3>
                        <p className="text-sm text-indigo-600 font-medium">{job.company}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {job.location}
                          </span>
                          {job.salary && (
                            <span className="text-green-600 font-medium">{job.salary}</span>
                          )}
                          {job.source && (
                            <span className="text-slate-400">via {job.source}</span>
                          )}
                          <span className="text-slate-400">Saved {formatDate(job.savedAt)}</span>
                        </div>
                      </div>

                      {/* Status selector */}
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={job.status}
                          onChange={(e) => updateStatus(job.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer outline-none ${meta.color}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => {
                            setExpandedId(isExpanded ? null : job.id);
                            if (!isExpanded) {
                              setEditingNotes(null);
                              setNotesText(job.notes ?? "");
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                          title="Toggle details"
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                          >
                            <polyline points="6,9 12,15 18,9" />
                          </svg>
                        </button>

                        <button
                          onClick={() => deleteJob(job.id)}
                          disabled={deletingId === job.id}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3,6 5,6 21,6" />
                            <path d="M19,6l-1,14H6L5,6" />
                            <path d="M10,11v6M14,11v6" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Notes preview */}
                    {job.notes && !isExpanded && (
                      <p className="text-xs text-slate-400 mt-2 italic line-clamp-1">{job.notes}</p>
                    )}
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-4">
                    {/* Description */}
                    {job.description && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{job.description}</p>
                      </div>
                    )}

                    {/* Contact */}
                    {job.contact && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Contact</p>
                        <p className="text-sm text-slate-700">{job.contact}</p>
                      </div>
                    )}

                    {/* Application link */}
                    {job.link && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Application Link</p>
                        <a
                          href={job.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:underline break-all"
                        >
                          {job.link}
                        </a>
                      </div>
                    )}

                    {/* Notes editor */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notes</p>
                      {editingNotes === job.id ? (
                        <div className="space-y-2">
                          <textarea
                            autoFocus
                            value={notesText}
                            onChange={(e) => setNotesText(e.target.value)}
                            rows={3}
                            placeholder="Add notes about this application..."
                            className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveNotes(job.id)}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingNotes(null)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-medium transition hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => { setEditingNotes(job.id); setNotesText(job.notes ?? ""); }}
                          className="min-h-[40px] rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-400 cursor-text hover:border-indigo-300 hover:text-slate-500 transition"
                        >
                          {job.notes || "Click to add notes..."}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
