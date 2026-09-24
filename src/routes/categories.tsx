import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowUpRight, Code2 } from "lucide-react";
import { SourcesMenu } from "@/components/atlas/SourcesMenu";
import { RepoAtlasLogo } from "@/components/atlas/RepoAtlasLogo";
import { useAtlasRepositories } from "@/lib/use-atlas-repositories";
import {
  CATEGORY_ORDER,
  CATEGORY_TOKEN,
  formatCompact,
  type Repository,
  type RepoCategory,
} from "@/lib/repositories";

export const Route = createFileRoute("/categories")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Categories — RepoAtlas" },
      { name: "description", content: "Browse repositories organized by category in the RepoAtlas knowledge atlas." },
    ],
  }),
  component: CategoriesPage,
});

// Category descriptions and icons
const CATEGORY_META: Record<RepoCategory, { description: string; emoji: string }> = {
  "AI & Agents": {
    emoji: "🤖",
    description: "Machine learning models, LLM integrations, AI agents, RAG pipelines, and intelligent automation projects.",
  },
  "Enterprise Java": {
    emoji: "☕",
    description: "Spring Boot microservices, Jakarta EE applications, Java frameworks, and enterprise-grade backend systems.",
  },
  "Cloud & DevOps": {
    emoji: "☁️",
    description: "Kubernetes, Docker, Terraform, CI/CD pipelines, cloud infrastructure, and platform engineering tools.",
  },
  "Web Development": {
    emoji: "🌐",
    description: "React, Next.js, Angular, Vue, and frontend frameworks powering modern web experiences.",
  },
  "Data & Tools": {
    emoji: "📊",
    description: "Databases, ETL pipelines, data workflows, SQL tooling, and developer utilities for data engineering.",
  },
  "Security": {
    emoji: "🔐",
    description: "Authentication, authorization, encryption, vulnerability scanning, and security hardening tools.",
  },
  "Developer Tools": {
    emoji: "🛠️",
    description: "CLI tools, plugins, code generators, boilerplates, SDKs, and productivity utilities for developers.",
  },
  "Mobile": {
    emoji: "📱",
    description: "Android, iOS, Flutter, and React Native applications for mobile platforms.",
  },
  "Other": {
    emoji: "📦",
    description: "Experimental projects, forks, general utilities, and repositories that span multiple domains.",
  },
};

// Language dot colours
const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f7df1e", Python: "#3572A5",
  Java: "#b07219", Go: "#00ADD8", Rust: "#dea584",
  CSS: "#563d7c", HTML: "#e34c26", Shell: "#89e051",
  Kotlin: "#A97BFF", Swift: "#F05138", Dart: "#00B4AB",
};

function CategoriesPage() {
  const { repositories, isLoading, isFetching, sourceKey, isDefault, urls } = useAtlasRepositories();

  // Group repos by category
  const byCategory = useMemo<Record<string, Repository[]>>(() => {
    const groups: Record<string, Repository[]> = {};
    CATEGORY_ORDER.forEach((cat) => { groups[cat] = []; });
    repositories.forEach((r) => {
      if (groups[r.category]) groups[r.category]!.push(r);
    });
    return groups;
  }, [repositories]);

  // Top subgroups per category
  const subgroupCounts = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    CATEGORY_ORDER.forEach((cat) => {
      const counts: Record<string, number> = {};
      (byCategory[cat] ?? []).forEach((r) => {
        counts[r.subgroup] = (counts[r.subgroup] ?? 0) + 1;
      });
      result[cat] = counts;
    });
    return result;
  }, [byCategory]);

  const totalRepos = repositories.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="atlas-header sticky top-0 z-40">
        <RepoAtlasLogo />
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <Link to="/" className="atlas-nav-item">Explore</Link>
          <Link to="/catalogue" className="atlas-nav-item">Catalogue</Link>
          <span className="atlas-nav-item is-active">Categories</span>
          <Link to="/insights" className="atlas-nav-item">Insights</Link>
          <Link to="/about" className="atlas-nav-item">About</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SourcesMenu
            sourceKey={sourceKey}
            isDefault={isDefault}
            repositories={repositories}
            urls={urls}
            isLoading={isLoading}
            isFetching={isFetching}
          />
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            ← Back to Atlas
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Page heading */}
        <div className="mb-10">
          <p className="atlas-eyebrow mb-2">Taxonomy</p>
          <h1 className="text-3xl font-bold text-foreground">Categories</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLoading && repositories.length === 0
              ? "Loading…"
              : isFetching && repositories.length > 0
              ? "Refreshing repositories…"
              : `${totalRepos} repositories across ${CATEGORY_ORDER.length} categories`}
          </p>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORY_ORDER.map((cat) => {
            const repos = byCategory[cat] ?? [];
            const meta = CATEGORY_META[cat];
            const catColor = `var(${CATEGORY_TOKEN[cat]})`;
            const subgroups = Object.entries(subgroupCounts[cat] ?? {})
              .sort((a, b) => b[1] - a[1]);
            const topLanguages = [...new Set(repos.map((r) => r.language).filter(Boolean) as string[])].slice(0, 4);
            const topRepos = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 3);
            const pct = totalRepos > 0 ? Math.round((repos.length / totalRepos) * 100) : 0;

            return (
              <div
                key={cat}
                className="group flex flex-col rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm transition-all hover:border-primary/25 hover:bg-card/70"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${catColor} 12%, transparent)`,
                        border: `1px solid color-mix(in oklab, ${catColor} 25%, transparent)`,
                      }}
                    >
                      {meta.emoji}
                    </div>
                    <div>
                      <h2
                        className="text-base font-bold"
                        style={{ color: catColor }}
                      >
                        {cat}
                      </h2>
                      <p className="text-[11px] text-muted-foreground">
                        {repos.length} repositories · {pct}% of atlas
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/catalogue"
                    search={{ category: cat } as never}
                    className="flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
                    aria-label={`View ${cat} repositories`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Progress bar */}
                <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-border/40">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: catColor }}
                  />
                </div>

                {/* Description */}
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {meta.description}
                </p>

                {/* Subgroups */}
                {subgroups.length > 0 && (
                  <div className="mt-4">
                    <p className="atlas-section-label mb-2">Subgroups</p>
                    <div className="flex flex-wrap gap-1.5">
                      {subgroups.map(([sg, count]) => (
                        <span
                          key={sg}
                          className="rounded-full border border-border/50 bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                        >
                          {sg} <span className="text-muted-foreground">({count})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {topLanguages.length > 0 && (
                  <div className="mt-4">
                    <p className="atlas-section-label mb-2">Languages</p>
                    <div className="flex gap-2">
                      {topLanguages.map((lang) => (
                        <span
                          key={lang}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: LANG_COLORS[lang] ?? "#94a3b8" }}
                          />
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top repos */}
                {topRepos.length > 0 && (
                  <div className="mt-4 border-t border-border/40 pt-4">
                    <p className="atlas-section-label mb-2">Top Repositories</p>
                    <div className="space-y-2">
                      {topRepos.map((repo) => (
                        <a
                          key={repo.id}
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Code2 className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            <span className="truncate text-xs text-foreground">{repo.name}</span>
                          </div>
                          <span className="ml-2 flex-shrink-0 text-[10px] text-muted-foreground">
                            ★ {formatCompact(repo.stars)}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="mt-4 pt-2">
                  <Link
                    to="/catalogue"
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-primary"
                    style={{ color: catColor }}
                  >
                    View all {repos.length} repositories
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
