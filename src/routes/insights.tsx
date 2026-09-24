import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import { SourcesMenu } from "@/components/atlas/SourcesMenu";
import { RepoAtlasLogo } from "@/components/atlas/RepoAtlasLogo";
import { useAtlasRepositories } from "@/lib/use-atlas-repositories";
import { CATEGORY_ORDER, CATEGORY_TOKEN, formatCompact } from "@/lib/repositories";

export const Route = createFileRoute("/insights")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Insights — RepoAtlas" },
      { name: "description", content: "Analytics and insights across your open-source repository atlas." },
    ],
  }),
  component: InsightsPage,
});

// Map CSS token → hex for Recharts (can't use CSS vars inside SVG)
const CATEGORY_HEX: Record<string, string> = {
  "--atlas-ai":       "#a78bfa",
  "--atlas-java":     "#fb923c",
  "--atlas-cloud":    "#60a5fa",
  "--atlas-web":      "#4ade80",
  "--atlas-data":     "#facc15",
  "--atlas-security": "#f87171",
  "--atlas-devtools": "#22d3ee",
  "--atlas-mobile":   "#f472b6",
  "--atlas-other":    "#94a3b8",
};

function getCatHex(cat: string): string {
  const token = CATEGORY_TOKEN[cat as keyof typeof CATEGORY_TOKEN];
  return CATEGORY_HEX[token] ?? "#94a3b8";
}

const CHART_BG    = "transparent";
const AXIS_COLOR  = "#4b5563";
const GRID_COLOR  = "#1f2937";
const TEXT_COLOR  = "#9ca3af";

/* ── Custom tooltip ──────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs shadow-xl backdrop-blur-md">
      {label && <p className="mb-1 font-semibold text-foreground">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? "#a78bfa" }}>
          {p.name}: <span className="font-bold">{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </p>
      ))}
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────── */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-3xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-5 text-lg font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
function InsightsPage() {
  const { repositories: repos, isLoading, isFetching, sourceKey, isDefault, urls } = useAtlasRepositories();

  /* ── Derived analytics ────────────────────────────────────── */
  const categoryData = useMemo(() =>
    CATEGORY_ORDER.map((cat) => ({
      name: cat.replace(" & ", " &\n"),   // label wrapping
      shortName: cat.split(" ")[0]!,
      count: repos.filter((r) => r.category === cat).length,
      color: getCatHex(cat),
    })).filter((d) => d.count > 0),
    [repos]
  );

  const languageData = useMemo(() => {
    const counts: Record<string, number> = {};
    repos.forEach((r) => { if (r.language) counts[r.language] = (counts[r.language] ?? 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [repos]);

  const topicData = useMemo(() => {
    const counts: Record<string, number> = {};
    repos.forEach((r) => r.topics.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name, count]) => ({ name, count }));
  }, [repos]);

  const starData = useMemo(() =>
    [...repos]
      .sort((a, b) => b.stars - a.stars)
      .slice(0, 15)
      .map((r) => ({ name: r.name, stars: r.stars, color: getCatHex(r.category) })),
    [repos]
  );

  const activityData = useMemo(() => {
    const monthly: Record<string, number> = {};
    repos.forEach((r) => {
      if (!r.pushedAt) return;
      const key = r.pushedAt.slice(0, 7); // "YYYY-MM"
      monthly[key] = (monthly[key] ?? 0) + 1;
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-18)
      .map(([month, count]) => ({ month: month.slice(5), count }));
  }, [repos]);

  const totalStars  = repos.reduce((s, r) => s + r.stars, 0);
  const totalForks  = repos.reduce((s, r) => s + r.forks, 0);
  const withTopics  = repos.filter((r) => r.topics.length > 0).length;
  const langCount   = new Set(repos.map((r) => r.language).filter(Boolean)).size;
  const mostPopular = [...repos].sort((a, b) => b.stars - a.stars)[0];
  const mostActive  = [...repos].sort((a, b) =>
    (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "")
  )[0];

  if (isLoading && repos.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <header className="atlas-header sticky top-0 z-40">
          <RepoAtlasLogo />
        </header>
        <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
          Loading insights…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="atlas-header sticky top-0 z-40">
        <RepoAtlasLogo />
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
          <Link to="/" className="atlas-nav-item">Explore</Link>
          <Link to="/catalogue" className="atlas-nav-item">Catalogue</Link>
          <Link to="/categories" className="atlas-nav-item">Categories</Link>
          <span className="atlas-nav-item is-active">Insights</span>
          <Link to="/about" className="atlas-nav-item">About</Link>
          <Link to="/settings" className="atlas-nav-item">Settings</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SourcesMenu
            sourceKey={sourceKey}
            isDefault={isDefault}
            repositories={repos}
            urls={urls}
            isLoading={isLoading}
            isFetching={isFetching}
          />
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Atlas
          </Link>
        </div>
      </header>

      {isFetching && repos.length > 0 && (
        <p className="border-b border-border/40 bg-card/30 px-6 py-2 text-center text-xs text-muted-foreground">
          Refreshing repositories…
        </p>
      )}

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-12">
        {/* Page heading */}
        <div>
          <p className="atlas-eyebrow mb-2">Analytics</p>
          <h1 className="text-3xl font-bold text-foreground">Insights</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A data-driven look across {repos.length} repositories.
          </p>
        </div>

        {/* ── KPI row ── */}
        <Section title="At a Glance">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Repositories"  value={repos.length} />
            <StatCard label="Total Stars"   value={formatCompact(totalStars)} />
            <StatCard label="Total Forks"   value={formatCompact(totalForks)} />
            <StatCard label="Languages"     value={langCount} />
            <StatCard label="Categories"    value={CATEGORY_ORDER.length} />
            <StatCard label="With Topics"   value={withTopics} sub={`${Math.round(withTopics / Math.max(1, repos.length) * 100)}% of repos`} />
          </div>

          {(mostPopular || mostActive) && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {mostPopular && (
                <a
                  href={mostPopular.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80"
                >
                  <span className="text-2xl">⭐</span>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Most Starred</p>
                    <p className="font-semibold text-foreground">{mostPopular.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCompact(mostPopular.stars)} stars · {mostPopular.category}</p>
                  </div>
                </a>
              )}
              {mostActive && (
                <a
                  href={mostActive.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80"
                >
                  <span className="text-2xl">🔥</span>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Most Recently Active</p>
                    <p className="font-semibold text-foreground">{mostActive.name}</p>
                    <p className="text-xs text-muted-foreground">{mostActive.pushedAt?.slice(0, 10)} · {mostActive.category}</p>
                  </div>
                </a>
              )}
            </div>
          )}
        </Section>

        {/* ── Category distribution ── */}
        <Section title="Repositories by Category">
          <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
                <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                  axisLine={{ stroke: AXIS_COLOR }}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" name="Repositories" radius={[4, 4, 0, 0]}>
                  {categoryData.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* ── Category pie + language bar ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Category Share">
            <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="count"
                    nameKey="shortName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={55}
                    paddingAngle={2}
                  >
                    {categoryData.map((d, i) => (
                      <Cell key={i} fill={d.color} fillOpacity={0.88} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    formatter={(v) => <span style={{ color: TEXT_COLOR, fontSize: 11 }}>{v}</span>}
                    iconSize={8}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Top Languages">
            <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  layout="vertical"
                  data={languageData}
                  margin={{ top: 4, right: 24, left: 0, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
                  <XAxis
                    type="number"
                    tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="count" name="Repositories" fill="#a78bfa" fillOpacity={0.80} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        {/* ── Top starred ── */}
        <Section title="Top Starred Repositories">
          <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={starData} margin={{ top: 8, right: 16, left: 0, bottom: 60 }}>
                <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: TEXT_COLOR, fontSize: 10 }}
                  axisLine={{ stroke: AXIS_COLOR }}
                  tickLine={false}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="stars" name="Stars" radius={[4, 4, 0, 0]}>
                  {starData.map((d, i) => (
                    <Cell key={i} fill={d.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* ── Activity timeline ── */}
        {activityData.length > 1 && (
          <Section title="Push Activity (last 18 months)">
            <div className="rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={activityData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID_COLOR} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: TEXT_COLOR, fontSize: 10 }}
                    axisLine={{ stroke: AXIS_COLOR }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: TEXT_COLOR, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Pushes"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    fill="url(#activityGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#a78bfa" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>
        )}

        {/* ── Top topics ── */}
        {topicData.length > 0 && (
          <Section title="Top Topics">
            <div className="flex flex-wrap gap-2">
              {topicData.map((t, i) => {
                const opacity = 0.4 + 0.6 * (1 - i / topicData.length);
                return (
                  <span
                    key={t.name}
                    className="rounded-full border px-3 py-1 text-xs font-medium"
                    style={{
                      borderColor: `rgba(167,139,250,${opacity * 0.4})`,
                      color: `rgba(167,139,250,${0.6 + opacity * 0.4})`,
                      backgroundColor: `rgba(167,139,250,${opacity * 0.06})`,
                      fontSize: `${Math.max(10, 11 + i * -0.15)}px`,
                    }}
                  >
                    {t.name} <span className="opacity-60">({t.count})</span>
                  </span>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
