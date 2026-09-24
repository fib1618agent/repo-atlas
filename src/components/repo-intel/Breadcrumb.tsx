import { Link } from "@tanstack/react-router";

/** Repository › dir › … › file, as real links so back/forward and open-in-tab work (FR-006). */
export function Breadcrumb({
  owner,
  name,
  path,
  file,
}: {
  owner: string;
  name: string;
  path: string;
  file: string | undefined;
}) {
  const segments = path === "" ? [] : path.split("/");
  const crumbs = segments.map((segment, i) => ({
    label: segment,
    path: segments.slice(0, i + 1).join("/"),
  }));
  const dirIsCurrent = !file;
  return (
    <nav aria-label="Repository path" data-breadcrumb>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        <li>
          {path === "" && dirIsCurrent ? (
            <span aria-current="page" className="font-medium">
              {name}
            </span>
          ) : (
            <Link
              to="/repository/$owner/$name"
              params={{ owner, name }}
              search={{}}
              className="inline-block px-1.5 py-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {name}
            </Link>
          )}
        </li>
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1 && dirIsCurrent;
          return (
            <li key={c.path} className="flex items-center gap-1">
              <span aria-hidden className="text-muted-foreground">
                ›
              </span>
              {last ? (
                <span aria-current="page" className="font-medium">
                  {c.label}
                </span>
              ) : (
                <Link
                  to="/repository/$owner/$name"
                  params={{ owner, name }}
                  search={{ path: c.path }}
                  className="inline-block px-1.5 py-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
        {file && (
          <li className="flex items-center gap-1">
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
            <span aria-current="page" className="font-medium">
              {file.slice(file.lastIndexOf("/") + 1)}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}
