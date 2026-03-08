import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import Groq from "groq-sdk";

export interface ResumeSection {
  name: string;
  content: string;
}

export interface TitleSuggestion {
  current: string;
  suggested: string;
  reason: string;
}

export interface AnalysisResult {
  matchScore: number;
  scoreBreakdown: {
    keywords: number;
    skills: number;
    experience: number;
    structure: number;
  };
  summary: string;
  foundKeywords: string[];
  missingKeywords: string[];
  requiredMissing: string[];
  preferredMissing: string[];
  weakBullets: Array<{ original: string; issue: string }>;
  suggestions: Array<{
    type: "keyword" | "bullet" | "section" | "format" | "verb" | "metric";
    priority: "high" | "medium" | "low";
    description: string;
    current?: string;
    improved?: string;
  }>;
  rewrittenBullets: Array<{
    section: string;
    original: string;
    rewritten: string;
  }>;
  skillsAnalysis: {
    matched: string[];
    missing: string[];
    extra: string[];
  };
  resumeSections: ResumeSection[];
  titleSuggestion: TitleSuggestion | null;
  profileRewrite: string | null;
  latexTemplate: string | null;
}

// ── Two-pass prompt: Extract JD requirements, then score ─────────────────────

const JD_EXTRACTION_PROMPT = (jobDescription: string) => `
Extract structured requirements from this job description.

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON (no markdown):
{
  "jobTitle": "<exact title from JD>",
  "requiredSkills": ["<explicitly required skill or technology>"],
  "preferredSkills": ["<nice-to-have or preferred skill>"],
  "requiredExperience": "<e.g. 3+ years, senior level, etc.>",
  "keyResponsibilities": ["<core responsibility or duty>"],
  "domain": "<industry/domain e.g. fintech, healthcare, SaaS>",
  "seniorityLevel": "<junior|mid|senior|lead>"
}
`;

const ANALYSIS_PROMPT = (
  resumeText: string,
  jdRequirements: string,
  jobDescription: string
) => `
You are a strict, calibrated ATS scoring engine. Your scores must be precise and honest — do NOT inflate them.

RESUME TEXT:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

EXTRACTED JD REQUIREMENTS:
${jdRequirements}

ATS SCORING RUBRIC — apply strictly:
- keywords (0–40): Count each required skill/keyword from JD found verbatim in resume. Score = floor((found_required / total_required) * 40). Penalise -2 for each critical required skill missing.
- skills (0–30): Required skills coverage. Score = floor((matched_required / total_required_skills) * 30).
- experience (0–20): Rate alignment of candidate's years of experience, seniority, and domain to JD. Strict.
- structure (0–10): ATS-friendly layout (clear sections, no tables/graphics in text, proper headings). Score 0-10.
- Final matchScore = sum of above, hard-clamped 0–100.
- If fewer than 40% of required skills are present, matchScore cannot exceed 50.

WEAK ACTION VERB LIST (flag these): was, did, helped, assisted, worked on, involved in, participated, responsible for, part of.
STRONG ACTION VERB examples: built, architected, designed, reduced, increased, delivered, engineered, led, optimised, deployed.

Return ONLY valid JSON (no markdown, no explanation):
{
  "matchScore": <integer 0-100 per rubric>,
  "scoreBreakdown": {
    "keywords": <0-40>,
    "skills": <0-30>,
    "experience": <0-20>,
    "structure": <0-10>
  },
  "summary": "<2-3 sentences: precise match quality, key strengths, critical gaps>",
  "foundKeywords": ["<JD keyword found verbatim in resume>"],
  "missingKeywords": ["<any JD keyword not in resume>"],
  "requiredMissing": ["<required skill/keyword from JD not in resume>"],
  "preferredMissing": ["<preferred/nice-to-have skill from JD not in resume>"],
  "weakBullets": [
    { "original": "<exact bullet with weak verb or no metric>", "issue": "<weak verb name | no metric>" }
  ],
  "suggestions": [
    {
      "type": "<keyword|bullet|section|format|verb|metric>",
      "priority": "<high|medium|low>",
      "description": "<specific, actionable>",
      "current": "<exact verbatim text from resume>",
      "improved": "<improved version using exact JD language>"
    }
  ],
  "rewrittenBullets": [
    {
      "section": "<section name>",
      "original": "<exact bullet>",
      "rewritten": "<ATS-optimized, strong verb, metric if possible, JD keywords>"
    }
  ],
  "skillsAnalysis": {
    "matched": ["<skill in both resume and JD>"],
    "missing": ["<required skill from JD missing in resume>"],
    "extra": ["<skill in resume not in JD>"]
  },
  "resumeSections": [
    { "name": "<section name>", "content": "<full verbatim content>" }
  ],
  "titleSuggestion": {
    "current": "<current resume title>",
    "suggested": "<exact title from JD if better match>",
    "reason": "<one sentence>"
  },
  "profileRewrite": "<A rewritten Profile/Summary section (3-4 sentences) naturally incorporating the top 5 JD keywords while staying true to the candidate's real experience. Or null if profile is already well-optimized.>"
}

Rules:
- matchScore MUST equal scoreBreakdown sum (before soft penalties). Verify your arithmetic.
- foundKeywords: only list keywords that appear literally in the resume text.
- requiredMissing: only list skills explicitly marked as required in the JD.
- preferredMissing: only list nice-to-have skills.
- suggestions: minimum 7, ordered high → medium → low. High-priority must have current + improved fields.
- weakBullets: list every bullet starting with a weak verb or lacking any metric.
- resumeSections: 4–7 sections, verbatim content.
- profileRewrite: make it ATS-friendly, keyword-dense, honest.
`;

function stripLatex(latex: string): string {
  return latex
    .replace(/\\begin\{[^}]+\}/g, "")
    .replace(/\\end\{[^}]+\}/g, "")
    .replace(/\\(?:textbf|textit|underline|emph|href|url|small|large|LARGE|normalsize|bfseries)\*?\{([^}]*)\}(?:\{[^}]*\})?/g, "$1")
    .replace(/\\[a-zA-Z@]+\*?\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z@]+/g, " ")
    .replace(/[{}[\]$|]/g, "")
    .replace(/%%[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function callGroq(client: Groq, systemMsg: string, userMsg: string, maxTokens: number) {
  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: maxTokens,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ],
  });
  let text = completion.choices[0].message.content?.trim() ?? "";
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const obj = text.match(/\{[\s\S]*\}/);
  return obj ? obj[0] : text;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const resumeFile = formData.get("resume") as File | null;
    const jobDescription = formData.get("jobDescription") as string | null;

    if (!resumeFile || !jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Resume file and job description are required." },
        { status: 400 }
      );
    }

    const fileName = resumeFile.name.toLowerCase();
    let resumeText: string;

    if (fileName.endsWith(".tex")) {
      resumeText = stripLatex(await resumeFile.text());
    } else {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      resumeText = (await pdfParse(buffer)).text.trim();
    }

    if (!resumeText) {
      return NextResponse.json(
        { error: "Could not extract text. For PDFs, ensure it is text-based (not scanned)." },
        { status: 400 }
      );
    }

    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const systemJson = "You are a strict JSON-only responder. Output valid JSON only. No markdown. No explanation.";

    // Pass 1: Extract JD requirements
    const jdJson = await callGroq(client, systemJson, JD_EXTRACTION_PROMPT(jobDescription), 1000);

    // Pass 2: Full analysis using extracted requirements
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const analysisJson = await callGroq(
          client,
          systemJson,
          ANALYSIS_PROMPT(resumeText, jdJson, jobDescription),
          5000
        );

        const result: AnalysisResult = JSON.parse(analysisJson);

        // Validate and fix score
        const bd = result.scoreBreakdown;
        if (bd) {
          const raw = (bd.keywords ?? 0) + (bd.skills ?? 0) + (bd.experience ?? 0) + (bd.structure ?? 0);
          result.matchScore = Math.max(0, Math.min(100, raw));
        }

        // Ensure required fields have defaults
        result.requiredMissing = result.requiredMissing ?? [];
        result.preferredMissing = result.preferredMissing ?? [];
        result.weakBullets = result.weakBullets ?? [];
        result.profileRewrite = result.profileRewrite ?? null;

        // Load LaTeX template from server filesystem
        try {
          result.latexTemplate = readFileSync(
            join(process.cwd(), "latex", "Idhaya_Resume_Final.tex"),
            "utf-8"
          );
        } catch {
          result.latexTemplate = null;
        }

        return NextResponse.json(result);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    throw lastError;
  } catch (err) {
    console.error("Analysis error:", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
