# job_apply_bot

A tool I built to stop copy-pasting my resume into job applications manually. It analyzes your resume against a job description, tells you what's missing, lets you fix it in the browser, and keeps track of where you've applied.

Built with Next.js 15, TypeScript, Tailwind CSS 4, Groq (Llama 3.3 70B), Prisma + SQLite, and the Adzuna API for live job listings.

---

## What it does

**Resume analyzer** — upload a PDF or `.tex` file, paste a job description, and get a score out of 100. It does two passes: first it pulls out what the JD is actually asking for, then it checks your resume against that. Tells you which keywords are missing, where your bullets are weak, and rewrites your summary if needed.

**Resume editor** — apply the suggestions directly in the browser without touching your original file. Download the result as a PDF when you're done.

**LaTeX compiler** — if you write your resume in LaTeX, it'll compile it to PDF via local `pdflatex` or fall back to an online service if pdflatex isn't installed.

**Job search** — searches Irish job listings via the Adzuna API. Filter by role, save anything interesting to the tracker.

**Application tracker** — saves jobs with a status (Saved → Applied → In Interview → Offer / Rejected) and a notes field. Nothing fancy, just a way to not lose track.

---

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| LLM | Groq SDK — Llama 3.3 70B |
| Database | SQLite via Prisma |
| Job data | Adzuna API |
| PDF | pdf-parse, jsPDF, pdflatex |

Also has the Anthropic and Google Generative AI SDKs installed — experimenting with swapping models.

---

## Setup

You'll need Node.js 18+, a [Groq API key](https://console.groq.com) (free), and an [Adzuna account](https://developer.adzuna.com) (also free). `pdflatex` is optional.

```bash
git clone https://github.com/IdhayaBastine15/job_apply_bot.git
cd job_apply_bot
npm install
```

Create `.env.local`:

```
GROQ_API_KEY=your_groq_api_key
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key
DATABASE_URL="file:./prisma/dev.db"
```

```bash
npx prisma migrate dev --name init
npm run dev
```

App runs at `http://localhost:3000`.

---

## Project layout

```
app/
  page.tsx              → resume optimizer
  search/page.tsx       → job search
  jobs/page.tsx         → application tracker
  api/
    analyze/            → resume analysis logic
    compile/            → LaTeX → PDF
    search/             → Adzuna search
    jobs/               → CRUD for saved jobs
lib/
  db.ts                 → Prisma client
prisma/
  schema.prisma
latex/
  Idhaya_Resume_Final.tex   → my actual resume template
```

---

## API routes

| Method | Route | What it does |
|---|---|---|
| POST | `/api/analyze` | Resume + JD → ATS score and suggestions |
| POST | `/api/compile` | LaTeX source → PDF |
| POST | `/api/search` | Fetch jobs from Adzuna |
| GET | `/api/jobs` | List saved jobs |
| POST | `/api/jobs` | Save a job |
| PATCH | `/api/jobs/:id` | Update status or notes |
| DELETE | `/api/jobs/:id` | Remove a job |

---

## Scoring

The analyzer scores on four things:

- Keywords — 40 pts
- Skills — 30 pts
- Experience — 20 pts
- Structure and formatting — 10 pts

---

## What's next

- Cover letter generation per JD
- Multi-model toggle in the UI (currently hardcoded to Groq)
- Auto-apply via Playwright
- Deploy properly (currently local only)

---

## License

MIT
