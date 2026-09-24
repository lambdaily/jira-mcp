export type JiraConfig = {
  baseUrl: string;
  authMode: "basic" | "bearer";
  email?: string;
  apiToken: string;
  apiVersion: "2" | "3";
};

export type JiraIssueSummary = {
  key: string;
  summary: string;
  description: string;
  status: string | null;
  issueType: string | null;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  components: string[];
  url: string;
};

type JiraIssueResponse = {
  key?: string;
  fields?: Record<string, unknown>;
};

type JiraSearchResponse = {
  issues?: JiraIssueResponse[];
  total?: number;
  isLast?: boolean;
  nextPageToken?: string;
};

const ISSUE_FIELDS = [
  "summary",
  "description",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "reporter",
  "labels",
  "components",
  "parent",
  "duedate",
  "created",
  "updated",
];

export function flattenJiraRichText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return "";

  if (Array.isArray(value)) {
    return value.map(flattenJiraRichText).filter(Boolean).join("");
  }

  const node = value as { type?: unknown; text?: unknown; content?: unknown };
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";

  const content = flattenJiraRichText(node.content);
  if (["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(String(node.type))) {
    return content ? `${content}\n` : "";
  }
  return content;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function textValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  const object = record(value);
  for (const key of ["displayName", "name", "value"]) {
    if (typeof object[key] === "string") return object[key] as string;
  }
  return null;
}

export function summarizeIssue(issue: JiraIssueResponse, baseUrl: string): JiraIssueSummary {
  const fields = record(issue.fields);
  const key = typeof issue.key === "string" ? issue.key : "UNKNOWN-0";
  const components = Array.isArray(fields.components)
    ? fields.components.map((item) => textValue(record(item).name)).filter((item): item is string => item !== null)
    : [];

  return {
    key,
    summary: typeof fields.summary === "string" ? fields.summary : "(sin resumen)",
    description: flattenJiraRichText(fields.description).trim(),
    status: textValue(record(fields.status).name),
    issueType: textValue(record(fields.issuetype).name),
    priority: textValue(record(fields.priority).name),
    assignee: textValue(fields.assignee),
    reporter: textValue(fields.reporter),
    labels: Array.isArray(fields.labels) ? fields.labels.filter((item): item is string => typeof item === "string") : [],
    components,
    url: `${baseUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(key)}`,
  };
}

export class JiraClient {
  private readonly baseUrl: string;
  private readonly headers: HeadersInit;

  constructor(private readonly config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    const authorization = config.authMode === "basic"
      ? `Basic ${Buffer.from(`${config.email ?? ""}:${config.apiToken}`).toString("base64")}`
      : `Bearer ${config.apiToken}`;
    this.headers = { Accept: "application/json", Authorization: authorization };
  }

  async getIssue(key: string): Promise<JiraIssueSummary> {
    const params = new URLSearchParams({ fields: ISSUE_FIELDS.join(",") });
    const result = await this.request<JiraIssueResponse>(
      `/rest/api/${this.config.apiVersion}/issue/${encodeURIComponent(key)}?${params}`,
    );
    return summarizeIssue(result, this.baseUrl);
  }

  async searchIssues(jql: string, maxResults: number): Promise<{ issues: JiraIssueSummary[]; total: number | null }> {
    const fields = ISSUE_FIELDS;
    let result: JiraSearchResponse;

    if (this.config.apiVersion === "3") {
      result = await this.request<JiraSearchResponse>(`/rest/api/3/search/jql`, {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ jql, maxResults, fields }),
      });
    } else {
      result = await this.request<JiraSearchResponse>(`/rest/api/2/search`, {
        method: "POST",
        headers: { ...this.headers, "Content-Type": "application/json" },
        body: JSON.stringify({ jql, maxResults, fields, startAt: 0 }),
      });
    }

    const issues = (result.issues ?? []).map((issue) => summarizeIssue(issue, this.baseUrl));
    return { issues, total: typeof result.total === "number" ? result.total : null };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers, ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();

    if (!response.ok) {
      const detail = body.replace(/\s+/g, " ").slice(0, 800);
      throw new Error(`Jira respondió HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      throw new Error("Jira devolvió una respuesta que no es JSON válido.");
    }
  }
}
