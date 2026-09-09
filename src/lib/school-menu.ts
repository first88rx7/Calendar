import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SchoolMenuParse } from "@/lib/types";

const execFileAsync = promisify(execFile);

function parserScript() {
  return path.join(process.cwd(), "scripts", "parse-school-menu.py");
}

async function pythonBin() {
  for (const bin of ["python3", "python"]) {
    try {
      await execFileAsync(bin, ["-c", "import pymupdf"], { timeout: 8000 });
      return bin;
    } catch {
      // try the next name
    }
  }
  throw new Error(
    "School menu import needs Python with pymupdf. On the LXC run: pip3 install --break-system-packages pymupdf",
  );
}

export async function parseSchoolMenuPdf(
  buffer: Buffer,
  filename: string,
  yearMonth?: string,
): Promise<SchoolMenuParse> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "school-menu-"));
  const pdfPath = path.join(dir, "menu.pdf");
  try {
    await writeFile(pdfPath, buffer);
    const bin = await pythonBin();
    const args = [parserScript(), pdfPath, "--filename", filename];
    if (yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)) {
      args.push("--month", yearMonth);
    }
    try {
      const { stdout } = await execFileAsync(bin, args, {
        timeout: 20_000,
        maxBuffer: 2_000_000,
        env: { ...process.env, PYTHONUNBUFFERED: "1", PYTHONDONTWRITEBYTECODE: "1" },
      });
      const jsonStart = stdout.indexOf("{");
      const parsed = JSON.parse(jsonStart >= 0 ? stdout.slice(jsonStart) : stdout) as SchoolMenuParse & {
        error?: string;
      };
      if (!parsed.meals) {
        throw new Error(parsed.error || "That PDF did not contain a school menu.");
      }
      return parsed;
    } catch (error) {
      const err = error as { stderr?: string; message?: string };
      if (err.stderr) {
        try {
          const payload = JSON.parse(err.stderr) as { error?: string };
          if (payload.error) throw new Error(payload.error);
        } catch (inner) {
          if (inner instanceof Error && inner.message && !inner.message.startsWith("Unexpected")) {
            throw inner;
          }
        }
      }
      throw new Error(err.message || "Could not read that school menu PDF.");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function yearMonthFromParse(parsed: SchoolMenuParse) {
  return `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
}

export function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  if (!year || !month) return yearMonth;
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
