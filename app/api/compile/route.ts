import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { promisify } from "util";

const execAsync = promisify(exec);

const PDFLATEX_PATHS = [
  "/Library/TeX/texbin/pdflatex",
  "/usr/texbin/pdflatex",
  "/usr/local/bin/pdflatex",
  "/opt/homebrew/bin/pdflatex",
  "/usr/bin/pdflatex",
];

function findPdflatex(): string | null {
  for (const p of PDFLATEX_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

async function compileLocally(latexSource: string): Promise<Buffer> {
  const pdflatex = findPdflatex();
  if (!pdflatex) throw new Error("pdflatex not found on this system");

  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tmpDir = join(tmpdir(), `resume_${id}`);
  await mkdir(tmpDir, { recursive: true });

  try {
    const texFile = join(tmpDir, "resume.tex");
    await writeFile(texFile, latexSource, "utf-8");

    // Run twice so references/TOC resolve (standard LaTeX practice)
    const cmd = `"${pdflatex}" -interaction=nonstopmode -output-directory="${tmpDir}" "${texFile}"`;
    await execAsync(cmd, { timeout: 30000 });
    await execAsync(cmd, { timeout: 30000 });

    return await readFile(join(tmpDir, "resume.pdf"));
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function compileOnline(latexSource: string): Promise<Buffer> {
  // latex.ytotech.com – free public LaTeX-on-HTTP instance
  const res = await fetch("https://latex.ytotech.com/builds/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compiler: "pdflatex",
      resources: [{ main: true, content: latexSource }],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Online service returned ${res.status}: ${msg}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function POST(req: NextRequest) {
  try {
    const { latexSource } = await req.json();

    if (!latexSource?.trim()) {
      return NextResponse.json({ error: "No LaTeX source provided." }, { status: 400 });
    }

    // 1. Try local pdflatex (fast, no network)
    try {
      const pdf = await compileLocally(latexSource);
      return new NextResponse(pdf.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="resume_optimized.pdf"',
        },
      });
    } catch (localErr) {
      console.log("Local pdflatex unavailable:", (localErr as Error).message);
    }

    // 2. Try online LaTeX compilation service
    try {
      const pdf = await compileOnline(latexSource);
      return new NextResponse(pdf.buffer as ArrayBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="resume_optimized.pdf"',
        },
      });
    } catch (onlineErr) {
      console.log("Online compilation failed:", (onlineErr as Error).message);
    }

    // 3. Fallback: return raw .tex for manual compilation (e.g. Overleaf)
    return new NextResponse(latexSource, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="resume_optimized.tex"',
        "X-Compile-Failed": "true",
      },
    });
  } catch (err) {
    console.error("Compile route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
