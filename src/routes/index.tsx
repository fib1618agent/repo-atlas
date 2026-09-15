import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Github, Search, Sparkles,
  MousePointer2, ZoomIn, RotateCcw, Pause, Play,
  Maximize2, GitBranch, Code2, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RepoAtlasLogo } from "@/components/atlas/RepoAtlasLogo";
import { RepositoryPanel } from "@/components/atlas/RepositoryPanel";
import { useAtlasStore } from "@/lib/atlas-store";
import { getRepositories } from "@/lib/repositories.functions";
import { CATEGORY_ORDER, CATEGORY_TOKEN, type RepoCategory, type Repository } from "@/lib/repositories";

const AtlasScene = lazy(() =>
  import("@/components/atlas/AtlasScene").then((m) => ({ default: m.AtlasScene }))
);

export const Route = createFileRoute("/")(({
  ssr: false,
  head: () => ({
    meta: [
      { title: "RepoAtlas — Explore Open Source Repositories" },
      { name: "description", content: "Explore GitHub and GitLab repositories in an interactive 3D knowledge atlas. Discover relationships, categories, and technologies at a glance." },
      { property: "og:title", content: "RepoAtlas — A Clearer Picture of Open Source" },
      { property: "og:description", content: "Discover repositories, categories, and technologies through an interactive 3D atlas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RepoAtlasPage,
} as any));

// ── GitLab SVG ──────────────────────────────────────────────────────────────
function GitLabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="GitLab">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51a.42.42 0 01.11-.18.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51 1.22 3.78a.84.84 0 01-.3.94z" />
    </svg>
  );
}

// ── Page component ──────────────────────────────────────────────────────────
function RepoAtlasPage() {
  const loadRepositories = useServerFn(getRepositories);
  const { data, isLoading } = useQuery({
    queryKey: ["repositories", "imdadareeph"],
    queryFn: () => loadRepositories(),
    staleTime: 10 * 60 * 1000,
  });
  const repositories = data?.repositories ?? [];

  const selectedId      = useAtlasStore((s) => s.selectedId);
  const hoveredId       = useAtlasStore((s) => s.hoveredId);
  const setSelected     = useAtlasStore((s) => s.setSelected);
  const setCategory     = useAtlasStore((s) => s.setCategory);
  const setLanguage     = useAtlasStore((s) => s.setLanguage);
  const setTopic        = useAtlasStore((s) => s.setTopic);
  const resetFilters    = useAtlasStore((s) => s.resetFilters);
  const activeCategory  = useAtlasStore((s) => s.category);
  const activeLanguage  = useAtlasStore((s) => s.language);
  const activeTopic     = useAtlasStore((s) => s.topic);
  const autoRotate      = useAtlasStore((s) => s.autoRotate);
  const showRelationships = useAtlasStore((s) => s.showRelationships);
  const toggleAutoRotate = useAtlasStore((s) => s.toggleAutoRotate);
  const toggleRelationships = useAtlasStore((s) => s.toggleRelationships);

  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [showMoreCategories, setShowMoreCategories] = useState(false);

  const selected = repositories.find((r) => r.id === selectedId);
  const hovered  = repositories.find((r) => r.id === hoveredId);

  const categoryCounts = useMemo(
    () => Object.fromEntries(
      CATEGORY_ORDER.map((cat) => [cat, repositories.filter((r) => r.category === cat).length])
    ),
    [repositories]
  );

  const sortedCategories = useMemo(
    () => [...CATEGORY_ORDER].sort((a, b) => (categoryCounts[b] ?? 0) - (categoryCounts[a] ?? 0)),
    [categoryCounts],
  );
  const topCategories = sortedCategories.slice(0, 5);
  const moreCategories = sortedCategories.slice(5);

  const allLanguages = useMemo(
    () => [...new Set(repositories.map((r) => r.language).filter(Boolean) as string[])].sort(),
    [repositories]
  );

  const allTopics = useMemo(
    () => {
      const counts = new Map<string, number>();
      repositories.forEach((r) => r.topics.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([t]) => t);
    },
    [repositories]
  );

  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return repositories
      .filter((r) =>
        `${r.name} ${r.description ?? ""} ${r.category} ${r.subgroup} ${r.language ?? ""} ${r.topics.join(" ")}`
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 6);
  }, [query, repositories]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelected(null); setQuery(""); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setSelected]);

  useEffect(() => {
    if (activeCategory && moreCategories.includes(activeCategory)) {
      setShowMoreCategories(true);
    }
  }, [activeCategory, moreCategories]);

  const selectRepository = (repo: Repository) => { setSelected(repo.id); setQuery(""); };

  const hasFilter = !!(activeCategory || activeLanguage || activeTopic);
  const platformCount = 2;

  return (
    <main className="atlas-page relative min-h-screen bg-background text-foreground">
      {/* ── Atmospheric glow ── */}
      <div className="atlas-vortex-glow" aria-hidden />

      {/* ── Header ── */}
      <header className="atlas-header">
        <RepoAtlasLogo />

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <span className="atlas-nav-item is-active">Explore</span>
          <Link to="/catalogue" className="atlas-nav-item">Catalogue</Link>
          <Link to="/categories" className="atlas-nav-item">Categories</Link>
          <Link to="/insights" className="atlas-nav-item">Insights</Link>
          <button type="button" className="atlas-nav-item">About</button>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SearchBox
            query={query}
            setQuery={setQuery}
            results={searchResults}
            selectRepository={selectRepository}
            searchRef={searchRef}
          />
          <a
            href="https://github.com/imdadareeph"
            target="_blank" rel="noreferrer"
            aria-label="GitHub profile"
            className="hidden text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            <Github className="h-4.5 w-4.5" />
          </a>
          <span className="hidden text-muted-foreground/40 sm:block">|</span>
          <span
            className="hidden text-muted-foreground sm:block"
            aria-label="GitLab"
            title="GitLab"
          >
            <GitLabIcon className="h-4 w-4 text-orange-400" />
          </span>
        </div>
      </header>

      {/* ── Canvas ── */}
      <section className="relative min-h-screen pt-[4.5rem]">
        <div className="atlas-canvas-wrap">
          {isLoading ? (
            <AtlasLoading />
          ) : (
            <Suspense fallback={<AtlasLoading />}>
              <AtlasScene
                repositories={repositories}
                onPointerPosition={(x, y) => setPointer({ x, y })}
              />
            </Suspense>
          )}
        </div>

        {/* ── UI overlay ── */}
        <div className="pointer-events-none absolute inset-0 z-10">

          {/* Hero copy */}
          <div className="atlas-copy pointer-events-auto">
            <p className="atlas-eyebrow">Open Source Ecosystem</p>
            <h1>
              All Repositories.<br />
              A Clearer <span>Picture.</span>
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-6 text-secondary-foreground">
              Explore thousands of GitHub and GitLab repositories in an interactive 3D
              knowledge atlas. Discover relationships, find relevant projects, and
              understand the open-source ecosystem at a glance.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:-translate-y-0.5 transition-all"
                onClick={() => searchRef.current?.focus()}
              >
                Start Exploring <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-border/60 bg-card/50 backdrop-blur-sm hover:bg-accent/60"
              >
                <a href="http://www.imdadareeph.com/" target="_blank" rel="noreferrer">
                  View Profile
                </a>
              </Button>
            </div>

            {/* Metrics */}
            <div className="mt-6 flex items-start gap-0 divide-x divide-border">
              <Stat value={repositories.length || "—"} label="Repositories" />
              <Stat value={CATEGORY_ORDER.length} label="Categories" />
              <Stat value={platformCount} label="Platforms" />
              <Stat value="∞" label="Possibilities" />
            </div>
          </div>

          {/* Category legend + filter controls */}
          <div id="categories" className="atlas-legend pointer-events-auto">
            <div className="mb-1 flex items-center justify-end">
              {hasFilter ? (
                <button
                  type="button"
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                  onClick={resetFilters}
                >
                  Clear filters
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground">Click to filter</span>
              )}
            </div>

            <Accordion type="single" collapsible defaultValue="categories" className="atlas-legend-accordion">
              <AccordionItem value="categories" className="border-border/60">
                <AccordionTrigger className="atlas-legend-trigger py-2 hover:no-underline">
                  Categories
                </AccordionTrigger>
                <AccordionContent className="pb-2 pt-0">
                  <div className="space-y-1">
                    {topCategories.map((cat) => (
                      <LegendCategoryRow
                        key={cat}
                        category={cat}
                        count={categoryCounts[cat] ?? 0}
                        isActive={activeCategory === cat}
                        onSelect={() => setCategory(cat)}
                      />
                    ))}
                  </div>
                  {moreCategories.length > 0 && (
                    <>
                      {showMoreCategories && (
                        <div className="atlas-legend-scroll mt-1 space-y-1">
                          {moreCategories.map((cat) => (
                            <LegendCategoryRow
                              key={cat}
                              category={cat}
                              count={categoryCounts[cat] ?? 0}
                              isActive={activeCategory === cat}
                              onSelect={() => setCategory(cat)}
                            />
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        className="mt-1.5 w-full text-left text-[10px] font-medium text-primary transition-colors hover:text-primary/80"
                        onClick={() => setShowMoreCategories((open) => !open)}
                      >
                        {showMoreCategories
                          ? "View less"
                          : `View more (${moreCategories.length})`}
                      </button>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>

              {allLanguages.length > 0 && (
                <AccordionItem value="language" className="border-border/60">
                  <AccordionTrigger className="atlas-legend-trigger py-2 hover:no-underline">
                    Language
                  </AccordionTrigger>
                  <AccordionContent className="pb-2 pt-0">
                    <div className="flex flex-wrap gap-1">
                      {allLanguages.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          className={`text-[10px] border rounded-full px-2 py-0.5 transition-colors ${
                            activeLanguage === lang
                              ? "border-primary text-primary bg-primary/10"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                          onClick={() => setLanguage(lang)}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              {allTopics.length > 0 && (
                <AccordionItem value="topics" className="border-border/60">
                  <AccordionTrigger className="atlas-legend-trigger py-2 hover:no-underline">
                    Topics
                  </AccordionTrigger>
                  <AccordionContent className="pb-2 pt-0">
                    <div className="atlas-legend-scroll flex flex-wrap gap-1">
                      {allTopics.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          className={`text-[10px] border rounded-full px-2 py-0.5 transition-colors ${
                            activeTopic === topic
                              ? "border-cyan-400 text-cyan-400 bg-cyan-400/10"
                              : "border-border text-muted-foreground hover:border-cyan-400/50 hover:text-foreground"
                          }`}
                          onClick={() => setTopic(topic)}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>

            {data?.source === "fallback" && (
              <p className="mt-2 text-[10px] text-muted-foreground">Showing saved snapshot.</p>
            )}
          </div>

          {/* ── Unified controls bar ── */}
          <div className="atlas-controls-position pointer-events-auto">
            <div className="atlas-controls">
              {/* Auto rotate toggle — label + state */}
              <button
                type="button"
                className="flex items-center gap-2 pr-1 transition-colors hover:text-foreground"
                style={{ color: "var(--foreground)" }}
                onClick={toggleAutoRotate}
                aria-label={autoRotate ? "Pause rotation" : "Resume rotation"}
              >
                {autoRotate
                  ? <Pause className="h-3.5 w-3.5 text-primary" />
                  : <Play  className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="flex flex-col items-start leading-none">
                  <span className="text-[11px] font-medium">Auto rotate</span>
                  <span className="text-[9px] text-muted-foreground">{autoRotate ? "On" : "Off"}</span>
                </span>
              </button>

              <span className="h-5 w-px bg-border" />

              {/* Interaction hints */}
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MousePointer2 className="h-3 w-3" aria-hidden />
                Drag to rotate
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ZoomIn className="h-3 w-3" aria-hidden />
                Scroll to zoom
              </span>
              <span
                className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => searchRef.current?.focus()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && searchRef.current?.focus()}
              >
                <Search className="h-3 w-3" aria-hidden />
                Search to focus
              </span>

              <span className="h-5 w-px bg-border" />

              {/* Links toggle */}
              <button
                type="button"
                className={`flex items-center gap-1 text-[11px] transition-colors ${
                  showRelationships ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={toggleRelationships}
                aria-label="Toggle relationship edges"
                title="Toggle category relationship lines"
              >
                <GitBranch className="h-3 w-3" />
                Links
              </button>

              <span className="h-5 w-px bg-border" />

              {/* Reset */}
              <button
                type="button"
                className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                onClick={resetFilters}
                aria-label="Reset filters and view"
                title="Reset"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                className="hidden rounded p-1 text-muted-foreground transition-colors hover:text-foreground md:block"
                onClick={() => document.documentElement.requestFullscreen?.()}
                aria-label="Enter full screen"
                title="Full screen"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>


          {/* Right panel */}
          {selected && <RepositoryPanel repository={selected} />}

          {/* Hover card */}
          {hovered && !selected && (
            <HoverCard repository={hovered} pointer={pointer} />
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="atlas-footer">
        <span className="font-semibold text-foreground/70">RepoAtlas</span>
        <span>Powered by Open Source</span>
        <span className="hidden sm:block">Explore the code that builds our world.</span>
      </footer>
    </main>
  );
}

// ── Legend category row ─────────────────────────────────────────────────────
function LegendCategoryRow({
  category,
  count,
  isActive,
  onSelect,
}: {
  category: RepoCategory;
  count: number;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`atlas-legend-row ${isActive ? "is-active" : ""}`}
      onClick={onSelect}
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: `var(${CATEGORY_TOKEN[category]})` }}
      />
      <span className="flex-1 text-left">{category}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
    </button>
  );
}

// ── Search box ──────────────────────────────────────────────────────────────
function SearchBox({
  query, setQuery, results, selectRepository, searchRef,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: Repository[];
  selectRepository: (r: Repository) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="relative w-full max-w-[22rem]">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={searchRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9 rounded-lg bg-card/60 pl-9 pr-14 text-sm backdrop-blur-sm border-border/60"
        placeholder="Search repositories, topics, orgs…"
        aria-label="Search repositories"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        ⌘ K
      </kbd>
      {query && (
        <div className="atlas-search-results">
          {results.length ? (
            results.map((repo) => (
              <button key={repo.id} type="button" onClick={() => selectRepository(repo)}>
                <span className="text-sm font-medium">{repo.name}</span>
                <small>{repo.category} · {repo.language ?? "Other"}</small>
              </button>
            ))
          ) : (
            <p>No matching repositories</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Hover card ──────────────────────────────────────────────────────────────
function HoverCard({
  repository, pointer,
}: { repository: Repository; pointer: { x: number; y: number } }) {
  const catColor = `var(${CATEGORY_TOKEN[repository.category] ?? "--atlas-other"})`;
  const left = Math.min(pointer.x + 20, window.innerWidth - 300);
  const top  = Math.min(pointer.y + 20, window.innerHeight - 180);

  return (
    <div className="atlas-hover-card" style={{ left, top }}>
      <div className="hc-category">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: catColor }}
        />
        {repository.category}
      </div>
      <h3>{repository.name}</h3>
      <p className="hc-desc">{repository.description ?? "No description provided."}</p>
      <div className="hc-meta">
        {repository.language && (
          <span>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "#94a3b8" }}
            />
            {repository.language}
          </span>
        )}
        {repository.stars > 0 && (
          <span>
            <Star className="h-3 w-3" />
            {repository.stars.toLocaleString()}
          </span>
        )}
        <span>GitHub</span>
      </div>
    </div>
  );
}

// ── Stat ────────────────────────────────────────────────────────────────────
function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="px-4 first:pl-0">
      <strong className="text-lg font-bold text-foreground tabular-nums">{value}</strong>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Loading ──────────────────────────────────────────────────────────────────
function AtlasLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
        Mapping repositories…
      </div>
    </div>
  );
}
