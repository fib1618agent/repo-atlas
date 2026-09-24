import { createFileRoute, Link } from "@tanstack/react-router";
import { RepoAtlasLogo } from "@/components/atlas/RepoAtlasLogo";
import { CodeIntelStatusSection } from "@/components/settings/CodeIntelStatusSection";
import { ConfigurationSection } from "@/components/settings/ConfigurationSection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — RepoAtlas" },
      {
        name: "description",
        content: "How this RepoAtlas instance is configured.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
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
          <span className="atlas-nav-item is-active">Settings</span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            ← Back to Atlas
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
        <div>
          <p className="atlas-eyebrow mb-2">Control plane</p>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <ConfigurationSection />
        <PreferencesSection />
        <CodeIntelStatusSection />
      </main>
    </div>
  );
}
