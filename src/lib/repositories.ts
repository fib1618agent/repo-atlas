export const CATEGORY_ORDER = [
  "AI & Agents",
  "Enterprise Java",
  "Cloud & DevOps",
  "Web Development",
  "Data & Tools",
  "Security",
  "Developer Tools",
  "Mobile",
  "Other",
] as const;

export type RepoCategory = (typeof CATEGORY_ORDER)[number];

export interface Repository {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  fork: boolean;
  archived: boolean;
  pushedAt: string | null;
  updatedAt: string;
  defaultBranch: string;
  sourceLogin?: string;
  sourceKind?: "user" | "org" | "repo";
  sourceUrl?: string;
  category: RepoCategory;
  subgroup: string;
  importance: number;
}

export const CATEGORY_TOKEN: Record<RepoCategory, string> = {
  "AI & Agents":     "--atlas-ai",
  "Enterprise Java": "--atlas-java",
  "Cloud & DevOps":  "--atlas-cloud",
  "Web Development": "--atlas-web",
  "Data & Tools":    "--atlas-data",
  "Security":        "--atlas-security",
  "Developer Tools": "--atlas-devtools",
  "Mobile":          "--atlas-mobile",
  "Other":           "--atlas-other",
};

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

export function classifyRepository(
  repo: Omit<Repository, "category" | "subgroup" | "importance">,
): Pick<Repository, "category" | "subgroup"> {
  const text = `${repo.name} ${repo.description ?? ""} ${repo.language ?? ""} ${repo.topics.join(" ")}`.toLowerCase();

  if (hasAny(text, ["agent", "rag", "llm", "langchain", "langgraph", "ollama", "openai", "gemini", "machine-learning", "artificial-intelligence", "chatbot", "gpt", "ai", "ml", "neural", "transformer"])) {
    const subgroup = hasAny(text, ["rag", "retrieval", "embedding", "vector"])
      ? "RAG & Retrieval"
      : hasAny(text, ["agent", "langgraph", "agentic"])
      ? "Agent Systems"
      : "Applied AI";
    return { category: "AI & Agents", subgroup };
  }
  if (hasAny(text, ["spring", "java", "microservice", "hibernate", "quarkus", "maven", "gradle", "junit", "jakarta"])) {
    const subgroup = hasAny(text, ["microservice", "eureka", "gateway", "kafka"])
      ? "Microservices"
      : hasAny(text, ["spring", "boot"])
      ? "Spring Boot"
      : "Java Foundations";
    return { category: "Enterprise Java", subgroup };
  }
  if (hasAny(text, ["security", "auth", "oauth", "jwt", "ssl", "tls", "encryption", "vulnerability", "penetration", "firewall", "sast", "dast", "siem", "xss", "csrf"])) {
    const subgroup = hasAny(text, ["auth", "oauth", "jwt", "sso", "iam"])
      ? "Auth & Identity"
      : hasAny(text, ["penetration", "vulnerability", "exploit"])
      ? "Offensive Security"
      : "Security Tooling";
    return { category: "Security", subgroup };
  }
  if (hasAny(text, ["docker", "kubernetes", "terraform", "ansible", "aws", "azure", "gcp", "devops", "ci-cd", "jenkins", "cloud", "helm", "k8s", "gitops", "pipeline", "nginx"])) {
    const subgroup = hasAny(text, ["docker", "kubernetes", "k8s", "container", "helm"])
      ? "Containers"
      : hasAny(text, ["terraform", "ansible", "infrastructure", "iac"])
      ? "Infrastructure"
      : "Cloud Platforms";
    return { category: "Cloud & DevOps", subgroup };
  }
  if (hasAny(text, ["android", "ios", "flutter", "react-native", "swift", "kotlin", "mobile", "expo"])) {
    const subgroup = hasAny(text, ["android", "kotlin"])
      ? "Android"
      : hasAny(text, ["ios", "swift"])
      ? "iOS"
      : "Cross-Platform";
    return { category: "Mobile", subgroup };
  }
  if (hasAny(text, ["cli", "tool", "plugin", "extension", "linter", "formatter", "generator", "boilerplate", "template", "starter", "scaffold", "utility", "helper", "sdk", "library", "package"])) {
    const subgroup = hasAny(text, ["cli", "terminal", "shell", "bash"])
      ? "CLI Tools"
      : hasAny(text, ["plugin", "extension", "addon"])
      ? "Plugins & Extensions"
      : "Developer Utilities";
    return { category: "Developer Tools", subgroup };
  }
  if (hasAny(text, ["react", "angular", "vue", "next", "javascript", "typescript", "html", "css", "frontend", "web", "tailwind", "svelte", "nuxt", "astro", "remix"])) {
    const subgroup = hasAny(text, ["react", "next", "remix"])
      ? "React Ecosystem"
      : hasAny(text, ["angular"])
      ? "Angular"
      : hasAny(text, ["vue", "nuxt"])
      ? "Vue Ecosystem"
      : "Web Foundations";
    return { category: "Web Development", subgroup };
  }
  if (hasAny(text, ["python", "sql", "database", "postgres", "mysql", "mongo", "data", "analytics", "etl", "pipeline", "airflow", "spark", "kafka", "redis", "elasticsearch", "rust", "go"])) {
    const subgroup = hasAny(text, ["sql", "database", "postgres", "mysql", "mongo", "redis", "elasticsearch"])
      ? "Databases"
      : hasAny(text, ["python", "data", "analytics", "etl", "spark"])
      ? "Data Workflows"
      : "Developer Utilities";
    return { category: "Data & Tools", subgroup };
  }
  return { category: "Other", subgroup: repo.fork ? "Forks & Experiments" : "General Projects" };
}

export function normalizeRepository(raw: Omit<Repository, "category" | "subgroup" | "importance">): Repository {
  const { category, subgroup } = classifyRepository(raw);
  const importance = Math.min(1, Math.log10(Math.max(1, raw.stars) + 1) / 5);
  return { ...raw, category, subgroup, importance };
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatUpdated(value: string | null): string {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
