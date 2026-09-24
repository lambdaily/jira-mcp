import { execFileSync } from "node:child_process";
import path from "node:path";

export type BranchConfig = {
  repoPath: string;
  baseBranch: string;
  prefix: string;
  pushBranch: boolean;
};

export type PreparedBranch = {
  repoPath: string;
  branchName: string;
  baseBranch: string;
  pushed: boolean;
};

function git(repoPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  }).trim();
}

export function makeBranchName(prefix: string, issueKey: string, summary: string): string {
  if (!/^[A-Z][A-Z0-9]+-\d+$/i.test(issueKey)) {
    throw new Error("La clave del issue no parece válida (ejemplo: PSP-1234). ");
  }
  const slug = summary
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "") || "issue";
  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "codex";
  return `${safePrefix}/${issueKey.toUpperCase()}-${slug}`;
}

export function prepareIssueBranch(config: BranchConfig, issueKey: string, summary: string): PreparedBranch {
  const repoPath = path.resolve(config.repoPath);
  const branchName = makeBranchName(config.prefix, issueKey, summary);
  const dirty = git(repoPath, ["status", "--porcelain"]);
  if (dirty) {
    throw new Error(`El repositorio tiene cambios sin guardar en ${repoPath}; guarda o aparta esos cambios antes de crear la rama.`);
  }

  git(repoPath, ["fetch", "origin", config.baseBranch]);
  const baseRef = `origin/${config.baseBranch}`;
  git(repoPath, ["rev-parse", "--verify", baseRef]);

  const localBranchExists = git(repoPath, ["branch", "--list", branchName]).length > 0;
  const remoteBranchExists = git(repoPath, ["ls-remote", "--heads", "origin", branchName]).length > 0;

  if (localBranchExists) {
    const current = git(repoPath, ["branch", "--show-current"]);
    if (current !== branchName) {
      throw new Error(`La rama local ${branchName} ya existe. Abre esa rama manualmente o elige otro prefijo.`);
    }
  } else if (remoteBranchExists) {
    git(repoPath, ["fetch", "origin", branchName]);
    git(repoPath, ["switch", "--track", "-c", branchName, `origin/${branchName}`]);
  } else {
    git(repoPath, ["switch", "-c", branchName, baseRef]);
  }

  if (config.pushBranch && !remoteBranchExists) {
    git(repoPath, ["push", "-u", "origin", branchName]);
  }

  return { repoPath, branchName, baseBranch: config.baseBranch, pushed: config.pushBranch };
}
