import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ROLES = [
  "Software Engineer",
  "Software Engineer II",
  "Full Stack Engineer",
  "Backend Software Engineer",
  "Platform Engineer",
];

interface AdzunaJob {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  description: string;
  redirect_url: string;
  salary_min?: number;
  salary_max?: number;
  created: string;
}

export interface JobSearchResult {
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  link: string;
  contact: string;
  postedDate: string;
  source: string;
}

export interface SearchResponse {
  jobs: JobSearchResult[];
  totalFound: number;
  searchSummary: string;
}

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return "Not specified";
  if (min && max) return `€${Math.round(min / 1000)}k–€${Math.round(max / 1000)}k`;
  if (min) return `From €${Math.round(min / 1000)}k`;
  return "Not specified";
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  return date.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const roles: string[] =
      Array.isArray(body.roles) && body.roles.length > 0 ? body.roles : DEFAULT_ROLES;

    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;

    if (!appId || !appKey) {
      return NextResponse.json(
        { error: "Adzuna API credentials not configured. Please add ADZUNA_APP_ID and ADZUNA_APP_KEY to your .env.local file. Get free keys at adzuna.com/api" },
        { status: 500 }
      );
    }

    // Search each role and merge results
    const query = roles.join(" OR ");
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: "20",
      what: query,
      where: "ireland",
      sort_by: "date",
      max_days_old: "30",
      content_type: "application/json",
    });

    const adzunaRes = await fetch(
      `https://api.adzuna.com/v1/api/jobs/ie/search/1?${params.toString()}`
    );

    if (!adzunaRes.ok) {
      const errText = await adzunaRes.text();
      console.error("Adzuna error:", errText);
      return NextResponse.json(
        { error: `Job search failed (${adzunaRes.status}). Please check your Adzuna API keys.` },
        { status: 500 }
      );
    }

    const data = await adzunaRes.json();
    const raw: AdzunaJob[] = data.results ?? [];

    const jobs: JobSearchResult[] = raw.map((job) => ({
      title: job.title,
      company: job.company.display_name,
      location: job.location.display_name,
      salary: formatSalary(job.salary_min, job.salary_max),
      description: job.description.replace(/<[^>]+>/g, "").slice(0, 300) + "...",
      link: job.redirect_url,
      contact: "Not listed",
      postedDate: formatDate(job.created),
      source: "Adzuna",
    }));

    return NextResponse.json({
      jobs,
      totalFound: data.count ?? jobs.length,
      searchSummary: `Found ${jobs.length} active listings in Ireland posted in the last 30 days via Adzuna.`,
    } satisfies SearchResponse);
  } catch (err) {
    console.error("Search error:", err);
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message, jobs: [], totalFound: 0 }, { status: 500 });
  }
}
