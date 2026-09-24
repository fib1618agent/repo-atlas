import { createFileRoute, Link } from "@tanstack/react-router";
import { RepoAtlasLogo } from "@/components/atlas/RepoAtlasLogo";
import { RepositoryIntelligenceView } from "@/components/repo-intel/RepositoryIntelligenceView";
import { dirOf } from "@/lib/repo-intel/format";
import { validateRepositorySearch } from "@/lib/repo-intel/search";

export const Route = createFileRoute("/repository/$owner/$name")({
  ssr: false,
  validateSearch: validateRepositorySearch,
  head: ({ params }) => ({
    meta: [
      { title: `${params.owner}/${params.name} — RepoAtlas` },
      {
        name: "description",
        content:
          "Repository intelligence: structure and symbols recorded by RepoAtlas.",
      },
    ],
  }),
  component: RepositoryIntelligencePage,
});

function RepositoryIntelligencePage() {
  const { owner, name } = Route.useParams();
  const search = Route.useSearch();
  const path = search.path ?? (search.file ? dirOf(search.file) : "");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="atlas-header sticky top-0 z-40">
        <RepoAtlasLogo />
        <nav
          className="hidden items-center gap-6 lg:flex"
          aria-label="Primary navigation"
        >
          <Link to="/" className="atlas-nav-item">
            Explore
          </Link>
          <Link to="/catalogue" className="atlas-nav-item">
            Catalogue
          </Link>
          <Link to="/categories" className="atlas-nav-item">
            Categories
          </Link>
          <Link to="/insights" className="atlas-nav-item">
            Insights
          </Link>
          <Link to="/about" className="atlas-nav-item">
            About
          </Link>
          <Link to="/settings" className="atlas-nav-item">
            Settings
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/catalogue"
            className="flex min-h-6 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to catalogue
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <RepositoryIntelligenceView
          owner={owner}
          name={name}
          path={path}
          file={search.file}
          symbol={search.symbol}
        />
      </main>
    </div>
  );
}
