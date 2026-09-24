import test from "node:test";
import assert from "node:assert/strict";
import { flattenJiraRichText, summarizeIssue } from "./jira.js";
import { makeBranchName } from "./worktree.js";

test("flattens Jira document-format descriptions", () => {
  const description = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Primera línea" }] },
      { type: "paragraph", content: [{ type: "text", text: "Segunda línea" }] },
    ],
  };
  assert.equal(flattenJiraRichText(description).trim(), "Primera línea\nSegunda línea");
});

test("summarizes issue fields and creates a browse URL", () => {
  const issue = summarizeIssue(
    { key: "PSP-42", fields: { summary: "Añadir filtro", status: { name: "Ready" }, labels: ["frontend"] } },
    "https://jira.example.com/",
  );
  assert.equal(issue.key, "PSP-42");
  assert.equal(issue.status, "Ready");
  assert.equal(issue.url, "https://jira.example.com/browse/PSP-42");
});

test("creates safe issue branch names", () => {
  assert.equal(makeBranchName("codex", "PSP-42", "Añadir filtro de mapas"), "codex/PSP-42-anadir-filtro-de-mapas");
  assert.throws(() => makeBranchName("codex", "not an issue key", "Something"));
});
