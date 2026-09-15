import { ArrowUpRight, GitFork, Star, X, CircleDot, CalendarDays, Code2, Link2, Sparkles, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAtlasStore } from "@/lib/atlas-store";
import { CATEGORY_TOKEN, formatCompact, formatUpdated, type Repository } from "@/lib/repositories";
import { getAISummary } from "@/lib/ai-summary.functions";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

// Language → colour mapping (best-effort, extensible)
const LANG_COLORS: Record<string, string> = {
  TypeScript:  "#3178c6", JavaScript: "#f7df1e", Python: "#3572A5",
  Java:        "#b07219", Go:         "#00ADD8", Rust:   "#dea584",
  CSS:         "#563d7c", HTML:       "#e34c26", Shell:  "#89e051",
  Ruby:        "#701516", PHP:        "#4F5D95", C:      "#555555",
  "C++":       "#f34b7d", "C#":       "#178600", Kotlin: "#A97BFF",
  Swift:       "#F05138", Dart:       "#00B4AB", Scala:  "#c22d40",
};

function LanguageBar({ language }: { language: string | null }) {
  if (!language) return null;
  const color = LANG_COLORS[language] ?? "#94a3b8";
  return (
    <div className="mt-5">
      <p className="atlas-section-label">Language</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="atlas-lang-bar flex-1">
          <div style={{ width: "100%", backgroundColor: color, borderRadius: 999 }} />
        </div>
        <span className="text-xs text-secondary-foreground">{language}</span>
      </div>
    </div>
  );
}

function TaxonomyTree({ category, subgroup }: { category: string; subgroup: string }) {
  return (
    <div className="mt-5">
      <p className="atlas-section-label">Topics & Category</p>
      <div className="mt-2 space-y-0.5 text-xs">
        <div className="flex items-center gap-1.5 text-foreground font-medium">
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: `var(${CATEGORY_TOKEN[category as keyof typeof CATEGORY_TOKEN] ?? "--atlas-other"})` }}
          />
          {category}
        </div>
        <div className="ml-3 flex items-center gap-1.5 text-muted-foreground">
          <span className="text-border">└</span> {subgroup}
        </div>
      </div>
    </div>
  );
}

function AISummarySection({ repository }: { repository: Repository }) {
  const fetchSummary = useServerFn(getAISummary);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSummary(null);
    fetchSummary({
      data: {
        name: repository.name,
        fullName: repository.fullName,
        description: repository.description,
        language: repository.language,
        topics: repository.topics,
        stars: repository.stars,
        forks: repository.forks,
        category: repository.category,
        subgroup: repository.subgroup,
      },
    })
      .then((result) => {
        if (!cancelled) setSummary(result.summary);
      })
      .catch(() => {
        if (!cancelled) setSummary("Unable to generate summary.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [repository.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="atlas-ai-summary">
      <div className="atlas-ai-badge">
        <Sparkles className="h-3 w-3" aria-hidden />
        AI Summary
      </div>
      {loading ? (
        <p className="text-muted-foreground animate-pulse text-xs">Generating summary…</p>
      ) : (
        <p>{summary}</p>
      )}
    </div>
  );
}

export function RepositoryPanel({ repository }: { repository: Repository }) {
  const setSelected = useAtlasStore((s) => s.setSelected);
  const catColor = `var(${CATEGORY_TOKEN[repository.category] ?? "--atlas-other"})`;

  return (
    <aside
      className="atlas-panel pointer-events-auto"
      aria-label={`${repository.name} repository details`}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="atlas-repo-icon" style={{ color: catColor }}>
          <Code2 aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="atlas-eyebrow">{repository.category}</p>
          </div>
          <h2 className="truncate text-lg font-bold leading-tight text-foreground">
            {repository.name}
          </h2>
          <p className="truncate text-xs text-muted-foreground">{repository.fullName}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={() => setSelected(null)}
          aria-label="Close repository details"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Platform badge ── */}
      <div className="mt-3 flex items-center gap-2">
        <span className="atlas-platform-badge">
          <Github className="h-3 w-3" aria-hidden />
          GitHub
        </span>
      </div>

      {/* ── Description ── */}
      <p className="mt-4 text-sm leading-6 text-secondary-foreground">
        {repository.description ?? "No repository description has been provided."}
      </p>

      {/* ── AI summary ── */}
      <AISummarySection repository={repository} />

      {/* ── URL ── */}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        <a
          href={repository.htmlUrl}
          target="_blank"
          rel="noreferrer"
          className="truncate hover:text-primary transition-colors"
        >
          {repository.htmlUrl}
        </a>
      </div>

      {/* ── Stats ── */}
      <div className="mt-4 grid grid-cols-3 border-y border-border py-3.5 text-center">
        <Metric icon={Star}      value={formatCompact(repository.stars)}      label="Stars"  />
        <Metric icon={GitFork}   value={formatCompact(repository.forks)}      label="Forks"  />
        <Metric icon={CircleDot} value={formatCompact(repository.openIssues)} label="Issues" />
      </div>

      {/* ── Topics ── */}
      {repository.topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {repository.topics.slice(0, 10).map((topic) => (
            <span className="atlas-chip" key={topic}>{topic}</span>
          ))}
          {repository.topics.length > 10 && (
            <span className="atlas-chip text-muted-foreground">+{repository.topics.length - 10} more</span>
          )}
        </div>
      )}

      {/* ── Taxonomy tree ── */}
      <TaxonomyTree category={repository.category} subgroup={repository.subgroup} />

      {/* ── Language bar ── */}
      <LanguageBar language={repository.language} />

      {/* ── Other details ── */}
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Detail icon={CalendarDays} label="Last pushed"    value={formatUpdated(repository.pushedAt)} />
        <Detail label="License"      value={repository.license ?? "Not specified"} />
        <Detail label="Branch"       value={repository.defaultBranch} />
        <Detail label="Forks"        value={repository.fork ? "This is a fork" : "Original"} />
      </div>

      {/* ── CTA ── */}
      <Button asChild className="mt-6 h-10 w-full">
        <a href={repository.htmlUrl} target="_blank" rel="noreferrer">
          View Repository <ArrowUpRight className="ml-1 h-4 w-4" />
        </a>
      </Button>
    </aside>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: { icon: typeof Star; value: string; label: string }) {
  return (
    <div className="border-r border-border last:border-r-0">
      <div className="flex items-center justify-center gap-1 text-sm font-semibold text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {value}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: { icon?: typeof Code2; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs text-foreground">{value}</p>
    </div>
  );
}
