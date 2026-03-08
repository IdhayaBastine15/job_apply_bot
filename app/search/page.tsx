"use client";

import { useState, KeyboardEvent } from "react";
import type { JobSearchResult, SearchResponse } from "@/app/api/search/route";

const DEFAULT_ROLES = [
  "Software Engineer",
  "Software Engineer II",
  "Full Stack Engineer",
  "Backend Software Engineer",
  "Platform Engineer (Mid-Level)",
];

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    linkedin: "bg-blue-100 text-blue-700",
    indeed: "bg-purple-100 text-purple-700",
    irishjobs: "bg-green-100 text-green-700",
    glassdoor: "bg-teal-100 text-teal-700",
  };
  const key = source.toLowerCase().split(".")[0].replace(/[^a-z]/g, "");
  const color = colors[key] || "bg-slate-100 text-slate-600";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{source}</span>
  );
}

export default function SearchPage() {
  const [availableRoles, setAvailableRoles] = useState([...DEFAULT_ROLES]);
  const [selectedRoles, setSelectedRoles] = useState(new Set(DEFAULT_ROLES));
  const [newRole, setNewRole] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  };

  const addRole = () => {
    const role = newRole.trim();
    if (!role) return;
    if (!availableRoles.includes(role)) {
      setAvailableRoles((prev) => [...prev, role]);
    }
    setSelectedRoles((prev) => new Set([...prev, role]));
    setNewRole("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addRole();
  };

  const removeRole = (role: string) => {
    setAvailableRoles((prev) => prev.filter((r) => r !== role));
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      next.delete(role);
      return next;
    });
  };

  const handleSearch = async () => {
    if (selectedRoles.size === 0) {
      setError("Please select at least one role to search for.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: [...selectedRoles] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (job: JobSearchResult) => {
    const key = `${job.title}|${job.company}`;
    setSavingId(key);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          link: job.link,
          contact: job.contact !== "Not listed" ? job.contact : null,
          salary: job.salary !== "Not specified" ? job.salary : null,
          source: job.source,
        }),
      });
      if (res.ok) setSavedIds((prev) => new Set([...prev, key]));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Find Jobs in Ireland</h1>
        <p className="text-slate-500 text-base mb-1">
          Searching for mid-level software engineering roles across Ireland
        </p>
        <p className="text-xs text-slate-400 mb-6">
          Stamp 1G · Dublin-based · Open to Remote &amp; Hybrid
        </p>

        {/* Role selector */}
        <div className="max-w-2xl mx-auto mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 text-left">
            Search for roles (click to toggle)
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {availableRoles.map((role) => {
              const isSelected = selectedRoles.has(role);
              const isCustom = !DEFAULT_ROLES.includes(role);
              return (
                <div key={role} className="flex items-center gap-0">
                  <button
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-l-full text-xs font-medium border transition-all ${isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:text-indigo-600"
                      } ${!isCustom ? "rounded-full" : ""}`}
                  >
                    {isSelected && (
                      <svg className="inline w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20,6 9,17 4,12" />
                      </svg>
                    )}
                    {role}
                  </button>
                  {isCustom && (
                    <button
                      onClick={() => removeRole(role)}
                      className={`px-2 py-1.5 rounded-r-full text-xs border-y border-r transition-all ${isSelected
                          ? "bg-indigo-700 text-white border-indigo-700"
                          : "bg-white text-slate-400 border-slate-300 hover:bg-red-50 hover:text-red-500 hover:border-red-300"
                        }`}
                      title="Remove role"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add custom role */}
          <div className="flex gap-2">
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a custom role (e.g. Data Engineer)..."
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
            />
            <button
              onClick={addRole}
              disabled={!newRole.trim()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-sm font-semibold transition flex items-center gap-1.5"
            >
              + Add
            </button>
          </div>
          {selectedRoles.size === 0 && (
            <p className="text-xs text-amber-600 mt-2">Select at least one role to search.</p>
          )}
        </div>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto flex gap-3">
          <div
            onClick={!loading && selectedRoles.size > 0 ? handleSearch : undefined}
            className={`flex-1 flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 bg-white shadow-sm transition-all ${loading || selectedRoles.size === 0
                ? "border-slate-200 cursor-not-allowed opacity-60"
                : "border-slate-200 hover:border-indigo-400 hover:shadow-md cursor-pointer"
              }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-slate-400 text-sm">
              {loading
                ? `Searching for: ${[...selectedRoles].join(", ")}...`
                : selectedRoles.size > 0
                  ? `Search for: ${[...selectedRoles].slice(0, 2).join(", ")}${selectedRoles.size > 2 ? ` +${selectedRoles.size - 2} more` : ""}`
                  : "Select roles above then search..."}
            </span>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || selectedRoles.size === 0}
            className="px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold text-sm transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Find Jobs
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-slate-700">Gemini is searching the web...</p>
              <p className="text-sm text-slate-400 mt-1">
                Scanning LinkedIn · Indeed · IrishJobs.ie · company career pages
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {result.totalFound ?? result.jobs.length} Jobs Found
              </h2>
              {result.searchSummary && (
                <p className="text-sm text-slate-500 mt-0.5">{result.searchSummary}</p>
              )}
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1,4 1,10 7,10" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
              </svg>
              Refresh
            </button>
          </div>

          {result.jobs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-medium">No structured results found.</p>
              <p className="text-sm mt-1">Try refreshing or adjusting your selected roles.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.jobs.map((job, i) => {
                const key = `${job.title}|${job.company}`;
                const isSaved = savedIds.has(key);
                const isSaving = savingId === key;
                return (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">{job.title}</h3>
                        <p className="text-sm text-indigo-600 font-medium mt-0.5">{job.company}</p>
                      </div>
                      {job.source && <SourceBadge source={job.source} />}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="flex items-center gap-1 text-slate-500">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {job.location}
                      </span>
                      {job.salary && job.salary !== "Not specified" && (
                        <span className="flex items-center gap-1 text-green-600 font-medium">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="1" x2="12" y2="23" />
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                          </svg>
                          {job.salary}
                        </span>
                      )}
                      {job.postedDate && <span className="text-slate-400">{job.postedDate}</span>}
                    </div>

                    {job.description && (
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{job.description}</p>
                    )}

                    {job.contact && job.contact !== "Not listed" && (
                      <p className="text-xs text-slate-500">
                        <span className="font-medium">Contact:</span> {job.contact}
                      </p>
                    )}

                    <div className="flex gap-2 mt-auto pt-1">
                      {job.link && job.link !== "Not available" ? (
                        <a
                          href={job.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-center px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition"
                        >
                          Apply Now →
                        </a>
                      ) : (
                        <span className="flex-1 text-center px-3 py-2 rounded-lg bg-slate-100 text-slate-400 text-xs font-semibold cursor-not-allowed">
                          No Link
                        </span>
                      )}
                      <button
                        onClick={() => handleSave(job)}
                        disabled={isSaved || isSaving}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold border transition ${isSaved
                            ? "border-green-200 bg-green-50 text-green-600 cursor-default"
                            : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                          }`}
                      >
                        {isSaved ? "✓ Saved" : isSaving ? "..." : "+ Track"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Ready to find your next role</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Select the roles you want to search for above, then click{" "}
            <strong>Find Jobs</strong> — Gemini will scan LinkedIn, Indeed, IrishJobs.ie and more.
          </p>
        </div>
      )}
    </div>
  );
}
