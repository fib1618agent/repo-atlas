import { Link } from "@tanstack/react-router";
import { splitFullName } from "@/lib/repo-intel/identity";

/** Entry link from a catalogue card to the Repository Intelligence view (FR-001). */
export function IntelligenceLink({ fullName }: { fullName: string }) {
  const params = splitFullName(fullName);
  if (!params) return null;
  return (
    <Link
      to="/repository/$owner/$name"
      params={params}
      className="px-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      Open repository intelligence →
    </Link>
  );
}
