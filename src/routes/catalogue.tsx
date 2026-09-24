import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, Filter, GitFork, Search, Star, X, CircleDot, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SourcesMenu } from "@/components/atlas/SourcesMenu";
import { RepoAtlasLogo } from "@/components/atlas/RepoAtlasLogo";
import { useAtlasRepositories } from "@/lib/use-atlas-repositories";
import { CATEGORY_ORDER, CATEGORY_TOKEN, formatCompact, formatUpdated, type Repository } from "@/lib/repositories";

export const Route = createFileRoute("/catalogue")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Catalogue — RepoAtlas" },
      { name: "description", content: "Browse and filter all repositories in the RepoAtlas catalogue." },
    ],
  }),
  component: CataloguePage,
});

const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f7df1e", Python: "#3572A5",
  Java: "#b07219", Go: "#00ADD8", Rust: "#dea584",
  CSS: "#563d7c", HTML: "#e34c26", Shell: "#89e051",
  Ruby: "#701516", PHP: "#4F5D95", Kotlin: "#A97BFF",
  Swift: "#F05138", Dart: "#00B4AB",
};

type SortKey = "stars" | "forks" | "updated" | "name";

function CataloguePage() {
  const { repositories, isLoading, isFetching, sourceKey, isDefault, urls } = useAtlasRepositories();

  const [query, setQuery]     = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [topic, setTopic]     = useState<string | null>(null);
  const [sortBy, setSortBy]   = useState<SortKey>("stars");
  const [showFilters, setShowFilters] = useState(false);

  const allLanguages = useMemo(
    () => [...new Set(repositories.map((r) => r.language).filter(Boolean) as string[])].sort(),
    [repositories]
  );

  const allTopics = useMemo(() => {
    const counts = new Map<string, number>();
    repositories.forEach((r) => r.topics.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([t]) => t);
  }, [repositories]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return repositories
      .filter((r) => {
        if (category && r.category !== category) return false;
        if (language && r.language !== language) return false;
        if (topic && !r.topics.includes(topic)) return false;
        if (needle && !`${r.name} ${r.description ?? ""} ${r.category} ${r.language ?? ""} ${r.topics.join(" ")}`.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "stars")   return b.stars - a.stars;
        if (sortBy === "forks")   return b.forks - a.forks;
        if (sortBy === "updated") return (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "");
        return a.name.localeCompare(b.name);
      });
  }, [repositories, query, category, language, topic, sortBy]);

  const hasFilter = !!(category || language || topic || query);
  const clearFilters = () => { setCategory(null); setLanguage(null); setTopic(null); setQuery(""); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="atlas-header sticky top-0 z-40">
        <RepoAtlasLogo />
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <Link to="/" className="atlas-nav-item">Explore</Link>
          <span className="atlas-nav-item is-active">Catalogue</span>
          <Link to="/categories" className="atlas-nav-item">Categories</Link>
          <Link to="/insights" className="atlas-nav-item">Insights</Link>
          <Link to="/about" className="atlas-nav-item">About</Link>
          <Link to="/settings" className="atlas-nav-item">Settings</Link>
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
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link to="/">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Atlas
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Page heading */}
        <div className="mb-8">
          <p className="atlas-eyebrow mb-2">Open Source Catalogue</p>
          <h1 className="text-3xl font-bold">
            Repository Catalogue
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLoading && repositories.length === 0
              ? "Loading repositories…"
              : isFetching && repositories.length > 0
              ? "Refreshing repositories…"
              : `${filtered.length} of ${repositories.length} repositories`}
          </p>
        </div>

        {/* Search + sort bar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9 bg-card/60 border-border/60 text-sm"
              placeholder="Search repositories…"
              aria-label="Search repositories"
            />
            {query && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort:</span>
            {(["stars", "forks", "updated", "name"] as SortKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`text-xs px-2.5 py-1 rounded border transition-colors capitalize ${
                  sortBy === key
                    ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                }`}
                onClick={() => setSortBy(key)}
              >
                {key}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border/60"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasFilter && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />}
          </Button>

          {hasFilter && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearFilters}>
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mb-6 rounded-lg border border-border/60 bg-card/50 p-4 backdrop-blur-sm space-y-4">
            {/* Category filter */}
            <div>
              <p className="atlas-section-label mb-2">Category</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ORDER.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      category === cat
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                    onClick={() => setCategory(category === cat ? null : cat)}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: `var(${CATEGORY_TOKEN[cat]})` }}
                    />
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Language filter */}
            <div>
              <p className="atlas-section-label mb-2">Language</p>
              <div className="flex flex-wrap gap-1.5">
                {allLanguages.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      language === lang
                        ? "border-primary text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                    onClick={() => setLanguage(language === lang ? null : lang)}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic filter */}
            <div>
              <p className="atlas-section-label mb-2">Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {allTopics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      topic === t
                        ? "border-cyan-400 text-cyan-400 bg-cyan-400/10"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-cyan-400/40"
                    }`}
                    onClick={() => setTopic(topic === t ? null : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Repository grid */}
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
            Loading repositories…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm">No repositories match your filters.</p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RepoCard({ repo }: { repo: Repository }) {
  const catColor = `var(${CATEGORY_TOKEN[repo.category] ?? "--atlas-other"})`;
  const langColor = LANG_COLORS[repo.language ?? ""] ?? "#94a3b8";

  return (
    <a
      href={repo.htmlUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col rounded-lg border border-border/60 bg-card/60 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `color-mix(in oklab, ${catColor} 15%, transparent)`, border: `1px solid ${catColor}` }}
          >
            <Code2 className="h-3.5 w-3.5" style={{ color: catColor }} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {repo.name}
            </h2>
            <p className="truncate text-[10px] text-muted-foreground">{repo.fullName}</p>
          </div>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Category badge */}
      <span
        className="mt-2.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
        style={{
          color: catColor,
          backgroundColor: `color-mix(in oklab, ${catColor} 12%, transparent)`,
          border: `1px solid color-mix(in oklab, ${catColor} 25%, transparent)`,
        }}
      >
        {repo.subgroup}
      </span>

      {/* Description */}
      <p className="mt-2.5 flex-1 text-xs leading-5 text-muted-foreground line-clamp-3">
        {repo.description ?? "No description provided."}
      </p>

      {/* Topics */}
      {repo.topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {repo.topics.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full border border-border/60 bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
          {repo.topics.length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{repo.topics.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {repo.stars > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {formatCompact(repo.stars)}
            </span>
          )}
          {repo.forks > 0 && (
            <span className="flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              {formatCompact(repo.forks)}
            </span>
          )}
          {repo.openIssues > 0 && (
            <span className="flex items-center gap-1">
              <CircleDot className="h-3 w-3" />
              {formatCompact(repo.openIssues)}
            </span>
          )}
        </div>
        {repo.language && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: langColor }}
            />
            {repo.language}
          </span>
        )}
      </div>
    </a>
  );
}
