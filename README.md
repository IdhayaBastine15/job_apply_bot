# Job Apply Bot

An AI-powered job application assistant that optimizes your resume against job descriptions and tracks your applications.

## Features

- **ATS Resume Optimizer** — Upload your resume (PDF or LaTeX) and a job description to get an instant ATS match score with detailed improvement suggestions
- **2-Pass AI Analysis** — First extracts structured requirements from the job description, then scores your resume against them using Groq Llama 3.3 70B
- **Resume Editor** — Apply AI suggestions (title rewrites, profile summaries, keyword injection, bullet point improvements) directly in the browser
- **LaTeX Compilation** — Compile your updated LaTeX resume to PDF via local `pdflatex` or an online fallback service
- **Job Search** — Search Ireland-based job listings via the Adzuna API with role filtering
- **Job Tracker** — Save jobs and track application status (Saved → Applied → In Interview → Selected / Rejected)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| AI / LLM | Groq SDK (Llama 3.3 70B) |
| Database | SQLite via Prisma |
| Job Search | Adzuna API |
| PDF Processing | pdf-parse, jsPDF, pdflatex |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Groq API key](https://console.groq.com)
- An [Adzuna API account](https://developer.adzuna.com) (free)
- `pdflatex` installed locally (optional — used for LaTeX compilation)

### Installation

```bash
git clone https://github.com/your-username/job_apply_bot.git
cd job_apply_bot
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key
DATABASE_URL="file:./prisma/dev.db"
```

### Database Setup

```bash
npx prisma migrate dev --name init
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. ATS Resume Optimizer (`/`)

1. Upload your resume (PDF or `.tex` file)
2. Paste the job description
3. Click **Analyze** to get your ATS match score (0–100)
4. Review and apply suggestions:
   - Missing keywords
   - Profile / summary rewrite
   - Weak action verb replacements
   - Bullet point improvements
5. Download the optimized resume as a PDF

### 2. Job Search (`/search`)

1. Enter job roles to search for (defaults to common Software Engineering roles)
2. Browse Ireland-based listings fetched from Adzuna
3. Save interesting jobs to your tracker

### 3. Job Tracker (`/jobs`)

- View all saved jobs in one dashboard
- Update status for each application
- Add notes per job
- Delete jobs you're no longer pursuing

## API Routes

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Analyze resume against job description |
| `POST` | `/api/compile` | Compile LaTeX source to PDF |
| `POST` | `/api/search` | Search jobs via Adzuna |
| `GET` | `/api/jobs` | List all saved jobs |
| `POST` | `/api/jobs` | Save a new job |
| `PATCH` | `/api/jobs/:id` | Update job status or notes |
| `DELETE` | `/api/jobs/:id` | Delete a saved job |

## ATS Scoring Breakdown

| Category | Weight |
|---|---|
| Keywords | 40 pts |
| Skills | 30 pts |
| Experience | 20 pts |
| Structure / Formatting | 10 pts |
| **Total** | **100 pts** |

## Project Structure

```
app/
├── page.tsx              # ATS Resume Optimizer
├── search/page.tsx       # Job Search
├── jobs/page.tsx         # Job Tracker
└── api/
    ├── analyze/          # Resume analysis engine
    ├── compile/          # LaTeX → PDF compilation
    ├── search/           # Adzuna job search
    └── jobs/             # Job CRUD endpoints
lib/
└── db.ts                 # Prisma client
prisma/
└── schema.prisma         # SQLite schema
latex/
└── Idhaya_Resume_Final.tex  # LaTeX resume template
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## License

MIT
