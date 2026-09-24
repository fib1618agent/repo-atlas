import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarDays, GitFork, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_TOKEN,
  formatCompact,
  formatUpdated,
  type Repository,
} from "@/lib/repositories";

/** Identity, owner context and provider metadata (FR-002, FR-003, FR-005). */
export function RepositoryHeader({
  repository,
  owner,
  name,
}: {
  repository: Repository;
  owner: string;
  name: string;
}) {
  const token = CATEGORY_TOKEN[repository.category] ?? "--atlas-other";
  return (
    <section aria-labelledby="repo-identity-heading" className="space-y-3">
      <p
        className="atlas-eyebrow flex flex-wrap items-center gap-x-2"
        data-owner-context
      >
        <span>Owner</span>
        <a
          href={`https://github.com/${owner}`}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-block py-1.5 normal-case underline-offset-2 hover:underline"
        >
          {owner}
        </a>
        <span aria-hidden>›</span>
        <Link
          to="/catalogue"
          className="inline-block py-1.5 normal-case underline-offset-2 hover:underline"
        >
          Repository catalogue
        </Link>
      </p>
      <h1
        id="repo-identity-heading"
        className="flex items-center gap-3 text-3xl font-bold break-all"
        data-repo-identity={`${owner}/${name}`}
      >
        <span
          aria-hidden
          className="inline-block h-4 w-4 shrink-0 rounded-full"
          style={{ backgroundColor: `var(${token})` }}
        />
        <span>
          <span className="text-muted-foreground">{owner}/</span>
          {name}
        </span>
      </h1>
      {repository.description && (
        <p className="max-w-3xl text-sm text-muted-foreground">
          {repository.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {repository.language && (
          <Badge variant="outline">{repository.language}</Badge>
        )}
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5" aria-hidden />{" "}
          {formatCompact(repository.stars)}
          <span className="sr-only"> stars</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <GitFork className="h-3.5 w-3.5" aria-hidden />{" "}
          {formatCompact(repository.forks)}
          <span className="sr-only"> forks</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Updated </span>
          {formatUpdated(repository.pushedAt ?? repository.updatedAt)}
        </span>
        <a
          href={repository.htmlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 py-1 underline-offset-2 hover:underline"
        >
          View on GitHub <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      {repository.topics.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
          {repository.topics.slice(0, 12).map((t) => (
            <li key={t}>
              <Badge variant="secondary">{t}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
