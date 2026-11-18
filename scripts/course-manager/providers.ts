import { findExecutable, runWithTimeout } from "./exec.ts";
import type {
  ApiKeyEnvStatus,
  CliProviderStatus,
  LiteLlmStatus,
  ProvidersReport,
} from "./types.ts";

function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t) return t;
  }
  return null;
}

function checkAgy(exe: string): CliProviderStatus {
  const verOut = runWithTimeout(exe, ["--version"], 6_000);
  const version = verOut.exitOk ? firstNonEmptyLine(verOut.stdout) : null;
  const models: string[] = [];
  let authStatus = "ready";
  let loggedIn: boolean | null = true;
  let note: string | null = null;

  const modOut = runWithTimeout(exe, ["models"], 12_000);
  if (modOut.timedOut) {
    authStatus = "timeout";
    loggedIn = null;
    note = "`agy models` vượt quá timeout 12s";
  } else if (modOut.exitOk) {
    for (const line of modOut.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("Fetching")) continue;
      const tabIdx = trimmed.indexOf("\t");
      const id = tabIdx >= 0 ? trimmed.slice(0, tabIdx).trim() : trimmed.split(/\s+/)[0];
      if (id) models.push(id);
    }
    if (models.length === 0) {
      authStatus = "no_models";
      loggedIn = false;
    }
  } else {
    authStatus = "error";
    loggedIn = false;
    note = firstNonEmptyLine(modOut.stderr) ?? firstNonEmptyLine(modOut.stdout);
  }

  return {
    id: "agy",
    display_name: "Antigravity CLI (agy)",
    installed: true,
    path: exe,
    version,
    auth_status: authStatus,
    logged_in: loggedIn,
    models,
    note,
  };
}

function checkClaude(exe: string): CliProviderStatus {
  const verOut = runWithTimeout(exe, ["--version"], 6_000);
  const version = verOut.exitOk ? firstNonEmptyLine(verOut.stdout) : null;

  let authStatus = "unknown";
  let loggedIn: boolean | null = null;
  let note: string | null = null;

  const authOut = runWithTimeout(exe, ["auth", "status"], 8_000);
  if (authOut.timedOut) {
    authStatus = "timeout";
    note = "`claude auth status` timeout";
  } else {
    try {
      const json = JSON.parse(authOut.stdout) as {
        loggedIn?: boolean;
        authMethod?: string;
        planTier?: string;
        subscriptionType?: string;
      };
      if (typeof json.loggedIn === "boolean") {
        loggedIn = json.loggedIn;
        if (json.loggedIn) {
          const method = json.authMethod ?? "logged_in";
          const tier = json.planTier ?? json.subscriptionType ?? "";
          authStatus = tier ? `logged_in (${method}, ${tier})` : `logged_in (${method})`;
        } else {
          authStatus = "not_logged_in";
        }
      }
    } catch {
      if (authOut.exitOk) {
        authStatus = "ok";
        loggedIn = true;
      } else {
        authStatus = "not_logged_in";
        loggedIn = false;
        note = firstNonEmptyLine(authOut.stderr);
      }
    }
  }

  return {
    id: "claude",
    display_name: "Claude Code CLI",
    installed: true,
    path: exe,
    version,
    auth_status: authStatus,
    logged_in: loggedIn,
    models: ["sonnet", "opus", "haiku"],
    note: note ?? "Alias chuẩn: haiku, sonnet, opus (hoặc tên model đầy đủ)",
  };
}

function checkCodex(exe: string): CliProviderStatus {
  const verOut = runWithTimeout(exe, ["--version"], 6_000);
  const version = verOut.exitOk ? firstNonEmptyLine(verOut.stdout) : null;

  let authStatus = "unknown";
  let loggedIn: boolean | null = null;
  let note: string | null = null;

  const loginOut = runWithTimeout(exe, ["login", "status"], 8_000);
  if (loginOut.timedOut) {
    authStatus = "timeout";
    note = "`codex login status` timeout";
  } else {
    const combined = `${loginOut.stdout}\n${loginOut.stderr}`;
    if (loginOut.exitOk && combined.toLowerCase().includes("logged in")) {
      loggedIn = true;
      authStatus = firstNonEmptyLine(combined) ?? "logged_in";
    } else {
      loggedIn = false;
      authStatus = "not_logged_in";
      note = firstNonEmptyLine(combined);
    }
  }

  return {
    id: "codex",
    display_name: "OpenAI Codex CLI",
    installed: true,
    path: exe,
    version,
    auth_status: authStatus,
    logged_in: loggedIn,
    models: [],
    note,
  };
}

function checkGenericCli(
  id: string,
  displayName: string,
  bins: readonly string[],
  listArgs?: readonly string[],
): CliProviderStatus {
  const exe = findExecutable(bins);
  if (!exe) {
    return {
      id,
      display_name: displayName,
      installed: false,
      path: null,
      version: null,
      auth_status: "not_installed",
      logged_in: null,
      models: [],
      note: null,
    };
  }
  const verOut = runWithTimeout(exe, ["--version"], 6_000);
  const version = verOut.exitOk ? firstNonEmptyLine(verOut.stdout) : null;
  const models: string[] = [];
  if (listArgs) {
    const listOut = runWithTimeout(exe, listArgs, 6_000);
    if (listOut.exitOk) {
      for (const line of listOut.stdout.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.toUpperCase().startsWith("NAME")) continue;
        const tok = t.split(/\s+/)[0];
        if (tok) models.push(tok);
      }
    }
  }
  return {
    id,
    display_name: displayName,
    installed: true,
    path: exe,
    version,
    auth_status: "installed",
    logged_in: null,
    models,
    note: null,
  };
}

async function checkLiteLlm(serverUrl: string): Promise<LiteLlmStatus> {
  const exe = findExecutable(["litellm.exe", "litellm.cmd", "litellm"]);
  const binaryVersion = exe
    ? firstNonEmptyLine(runWithTimeout(exe, ["--version"], 6_000).stdout)
    : null;
  const cleanUrl = serverUrl.replace(/\/+$/, "");
  const modelsUrl = `${cleanUrl}/v1/models`;

  let serverReachable = false;
  let models: string[] = [];
  let error: string | null = null;

  try {
    const headers: Record<string, string> = {};
    const apiKey = process.env.LITELLM_API_KEY?.trim();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const resp = await fetch(modelsUrl, {
      headers,
      signal: AbortSignal.timeout(3_000),
    });
    if (resp.ok) {
      serverReachable = true;
      const body = (await resp.json()) as { data?: Array<{ id?: string }> };
      models = (body.data ?? []).map((item) => item.id ?? "").filter(Boolean);
    } else {
      error = `HTTP ${resp.status}`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return {
    binary_installed: exe !== null,
    binary_path: exe,
    binary_version: binaryVersion,
    server_url: serverUrl,
    server_reachable: serverReachable,
    models,
    error,
  };
}

export async function scanAllProviders(litellmUrl: string): Promise<ProvidersReport> {
  const agyExe = findExecutable(["agy.exe", "agy.cmd", "agy"]);
  const claudeExe = findExecutable(["claude.exe", "claude.cmd", "claude"]);
  const codexExe = findExecutable(["codex.exe", "codex.cmd", "codex"]);

  const cli_providers: CliProviderStatus[] = [
    agyExe ? checkAgy(agyExe) : checkGenericCli("agy", "Antigravity CLI (agy)", ["agy"]),
    claudeExe
      ? checkClaude(claudeExe)
      : checkGenericCli("claude", "Claude Code CLI", ["claude"]),
    codexExe ? checkCodex(codexExe) : checkGenericCli("codex", "OpenAI Codex CLI", ["codex"]),
    checkGenericCli("gemini", "Google Gemini CLI", ["gemini.exe", "gemini.cmd", "gemini"]),
    checkGenericCli(
      "ollama",
      "Ollama (Local)",
      ["ollama.exe", "ollama"],
      ["list"],
    ),
    checkGenericCli("opencode", "OpenCode CLI", ["opencode.exe", "opencode.cmd", "opencode"]),
  ];

  const envVars: Array<[string, string]> = [
    ["ANTHROPIC_API_KEY", "Anthropic"],
    ["OPENAI_API_KEY", "OpenAI"],
    ["GEMINI_API_KEY", "Google Gemini"],
    ["GOOGLE_API_KEY", "Google AI"],
    ["OPENROUTER_API_KEY", "OpenRouter"],
    ["DEEPSEEK_API_KEY", "DeepSeek"],
    ["GROQ_API_KEY", "Groq"],
    ["XAI_API_KEY", "xAI"],
    ["LITELLM_API_KEY", "LiteLLM Proxy Master Key"],
  ];

  const api_key_envs: ApiKeyEnvStatus[] = envVars.map(([env_var, provider_hint]) => ({
    env_var,
    provider_hint,
    is_set: Boolean(process.env[env_var]?.trim()),
  }));

  return {
    cli_providers,
    litellm: await checkLiteLlm(litellmUrl),
    api_key_envs,
  };
}
