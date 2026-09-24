# Jira MCP for Codex

Local MCP server that gives Codex read access to Jira issues and prepares a Git branch from `origin/dev` in the selected repository.

## What it does

- `jira_get_issue`: read one issue and its acceptance context.
- `jira_search_issues`: find issues with JQL.
- `jira_prepare_issue_branch`: fetch an issue, require a clean target repository, and create/select `codex/<ISSUE>-<summary>` from `origin/dev`.
- Branch publishing is optional and disabled by default. Set `PUSH_BRANCH=true` to push a newly created branch to GitHub.

The bridge does not change Jira status or merge code. Codex does the implementation after the branch tool returns, in the repository opened as the Codex project.

## Requirements

- Node.js 20 or newer.
- A local clone of the code repository. For the trial repository, its base branch is `dev`.
- Jira Cloud API token credentials, or a Jira Data Center personal access token.

## Configure Jira and the target repository

```sh
cp .env.example .env
```

For Jira Cloud, set:

```dotenv
JIRA_BASE_URL=https://your-site.atlassian.net
JIRA_AUTH_MODE=basic
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your-token
JIRA_API_VERSION=3
TARGET_REPO_PATH=/absolute/path/to/stoplight-web
BASE_BRANCH=dev
BRANCH_PREFIX=codex
PUSH_BRANCH=false
```

For Jira Data Center, use `JIRA_AUTH_MODE=bearer`, put the personal access token in `JIRA_API_TOKEN`, and set `JIRA_API_VERSION=2`.

Keep `.env` local. It is ignored by Git. Never paste a token into a Codex prompt or commit it.

Install and build:

```sh
npm install
npm run build
```

## Connect the server to Codex

Add this to `~/.codex/config.toml`, replacing the path with this repository's absolute path:

```toml
[mcp_servers.jira]
command = "node"
args = ["/absolute/path/to/jira-mcp/dist/server.js"]
```

Restart Codex after changing MCP configuration. Open the `stoplight-web` clone as the Codex project, then ask Codex to work on a Jira issue, for example: `Implement PSP-1234`. Codex should read the issue, call `jira_prepare_issue_branch`, and work in the returned branch.

The configured `TARGET_REPO_PATH` must be the same local clone opened in Codex. The branch tool refuses to switch branches while there are uncommitted changes.

## Local test flow

With `.env` configured and the server connected, ask Codex:

```text
Show me PSP-1234 from Jira and prepare its development branch. Do not start implementation yet.
```

Review the issue details and branch name. Then ask Codex to implement the acceptance criteria. Set `PUSH_BRANCH=true` only if the branch should be published to `origin` automatically.

## Jira-triggered automation

This version starts work when you invoke it from Codex. Fully automatic execution after a Jira status transition needs an HTTPS webhook receiver and a runner that can start an agent. Jira Automation supports sending an outgoing web request; configure that after the manual flow is confirmed and the desired ready status is known.
