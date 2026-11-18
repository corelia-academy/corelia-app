import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export interface CmdOutput {
  exitOk: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Finds an executable across `PATH` and common Windows portable install directories.
 */
export function findExecutable(names: readonly string[]): string | null {
  const searchDirs: string[] = [];
  const pathVar = process.env.PATH ?? "";
  for (const part of pathVar.split(path.delimiter)) {
    if (part.trim()) searchDirs.push(part.trim());
  }

  if (process.platform === "win32") {
    const extras = [
      "H:\\packages\\bin",
      process.env.APPDATA ? path.join(process.env.APPDATA, "npm") : "",
      process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".local", "bin") : "",
      process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "Programs", "Ollama")
        : "",
    ].filter(Boolean);
    for (const extra of extras) {
      if (!searchDirs.includes(extra)) searchDirs.push(extra);
    }
  }

  for (const dir of searchDirs) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (fs.statSync(candidate).isFile()) {
          return candidate;
        }
      } catch {
        // ignore missing candidate
      }
    }
  }
  return null;
}

export function runWithTimeout(
  exe: string,
  args: readonly string[],
  timeoutMs: number,
): CmdOutput {
  return runCmd(exe, args, undefined, undefined, timeoutMs);
}

/**
 * Runs a binary or `.cmd`/`.bat` wrapper with optional working directory, stdin payload, and hard timeout.
 */
export function runCmd(
  exe: string,
  args: readonly string[],
  cwd?: string,
  stdinData?: string,
  timeoutMs = 60_000,
): CmdOutput {
  const ext = path.extname(exe).toLowerCase();
  const isBatch = process.platform === "win32" && (ext === ".cmd" || ext === ".bat");

  const command = isBatch ? "cmd" : exe;
  const cmdArgs = isBatch ? ["/C", exe, ...args] : [...args];

  const res = spawnSync(command, cmdArgs, {
    cwd,
    input: stdinData,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 24 * 1024 * 1024,
  });

  const errCode = (res.error as NodeJS.ErrnoException | undefined)?.code;
  const timedOut = errCode === "ETIMEDOUT";
  const stdout = res.stdout ?? "";
  const stderr = res.error && !timedOut ? `${res.stderr ?? ""}\n${res.error.message}`.trim() : (res.stderr ?? "");

  return {
    exitOk: !timedOut && !res.error && res.status === 0,
    exitCode: res.status,
    stdout,
    stderr,
    timedOut,
  };
}
