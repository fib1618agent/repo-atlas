import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { splitFullName } from "@/lib/repo-intel/identity";

/** Entry button from the Explore repository panel to the Repository Intelligence view (FR-001). */
export function IntelligenceButton({ fullName }: { fullName: string }) {
  const params = splitFullName(fullName);
  if (!params) return null;
  return (
    <Button asChild variant="outline" className="mt-2 h-10 w-full">
      <Link to="/repository/$owner/$name" params={params}>
        Open Repository Intelligence
      </Link>
    </Button>
  );
}
