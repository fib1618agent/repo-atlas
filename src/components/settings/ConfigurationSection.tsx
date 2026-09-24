import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { atlasErrorMessage, parseAtlasError } from "@/lib/atlas-errors";
import { useAtlasStore } from "@/lib/atlas-store";
import type {
  ConfigValue,
  ConfigurationItem,
} from "@/lib/control-plane/configuration-read-model";
import { getConfiguration } from "@/lib/control-plane/control-plane.functions";
import type { Preferences } from "@/lib/control-plane/preferences";
import {
  SETTING_REGISTRY,
  type PreferenceDefinition,
  type ReasonCode,
} from "@/lib/control-plane/setting-registry";

const CATEGORY_LABEL = {
  A: "A · Preference",
  B: "B · Deployment",
  C: "C · Secret",
  D: "D · Status",
} as const;

const REASON_TEXT: Record<ReasonCode, string> = {
  no_binding: "Not available in this environment",
  disabled_by_configuration: "Turned off by configuration",
  not_supported_here: "Not supported in this environment",
  query_failed: "Could not be checked",
};

function formatValue(value: ConfigValue): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object")
    return (
      value.map((s) => `${s.type}:${s.owner}`).join(", ") || "(empty list)"
    );
  return String(value);
}

function CategoryBadge({
  category,
}: {
  category: keyof typeof CATEGORY_LABEL;
}) {
  return <Badge variant="outline">{CATEGORY_LABEL[category]}</Badge>;
}

function ValueCell({
  item,
}: {
  item: Extract<ConfigurationItem, { display: "value" }>;
}) {
  if (item.state === "invalid") {
    return (
      <div className="space-y-1">
        <span className="font-medium text-destructive">
          Invalid / unavailable
        </span>
        <p className="text-xs text-muted-foreground">
          The configured value cannot be used. RepoAtlas does not repair it.
          {item.default !== undefined
            ? ` For reference, the default is ${formatValue(item.default)}.`
            : ""}
        </p>
      </div>
    );
  }
  if (item.state === "unset") {
    return item.value === undefined ? (
      <span className="text-muted-foreground">Not set</span>
    ) : (
      <span className="flex flex-wrap items-center gap-2">
        <code>{formatValue(item.value)}</code>
        <Badge variant="secondary">default</Badge>
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <code>{formatValue(item.value)}</code>
      {item.isDefault ? <Badge variant="secondary">default</Badge> : null}
      {item.flag === "unrecognized" ? (
        <Badge variant="outline" className="border-amber-500/60 text-amber-600">
          unrecognized configured value
        </Badge>
      ) : null}
    </span>
  );
}

function StatusCell({
  item,
}: {
  item: Exclude<ConfigurationItem, { display: "value" }>;
}) {
  if (item.display === "status") {
    return (
      <div className="space-y-1">
        <Badge variant={item.status === "configured" ? "secondary" : "outline"}>
          {item.status === "configured" ? "configured" : "not configured"}
        </Badge>
        {item.status === "not_configured" ? (
          <p className="text-xs text-muted-foreground">
            {item.degradesWhenMissing}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Badge
        variant={item.availability === "available" ? "secondary" : "outline"}
      >
        {item.availability === "available" ? "Available" : "Unavailable"}
      </Badge>
      {item.reason ? (
        <p className="text-xs text-muted-foreground">
          {REASON_TEXT[item.reason]}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  category,
  clientVisible,
  children,
}: {
  label: string;
  category: keyof typeof CATEGORY_LABEL;
  clientVisible?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell className="align-top font-medium">
        <span className="flex flex-wrap items-center gap-2">
          {label}
          {clientVisible ? (
            <Badge variant="outline">client-visible</Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell className="align-top">
        <CategoryBadge category={category} />
      </TableCell>
      <TableCell className="align-top">{children}</TableCell>
    </TableRow>
  );
}

/** Presentational and read-only: renders only what the DTO and registry carry. */
export function ConfigurationList({
  items,
  preferences,
}: {
  items: ConfigurationItem[];
  preferences: Preferences;
}) {
  const preferenceRows = SETTING_REGISTRY.filter(
    (d): d is PreferenceDefinition => d.category === "A",
  );
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Setting</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Effective value / status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preferenceRows.map((def) => {
            const current =
              preferences[def.id.replace("pref.", "") as keyof Preferences];
            return (
              <Row key={def.id} label={def.label} category="A">
                <span className="flex flex-wrap items-center gap-2">
                  <code>{formatValue(current)}</code>
                  {current === def.default ? (
                    <Badge variant="secondary">default</Badge>
                  ) : null}
                </span>
              </Row>
            );
          })}
          {items.map((item) => (
            <Row
              key={item.id}
              label={item.label}
              category={item.category}
              clientVisible={item.display === "value" && item.clientVisible}
            >
              {item.display === "value" ? (
                <ValueCell item={item} />
              ) : (
                <StatusCell item={item} />
              )}
            </Row>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ConfigurationSection() {
  const loadConfiguration = useServerFn(getConfiguration);
  const autoRotate = useAtlasStore((s) => s.autoRotate);
  const showRelationships = useAtlasStore((s) => s.showRelationships);
  const query = useQuery({
    queryKey: ["control-plane", "configuration"],
    queryFn: () => loadConfiguration({}),
    retry: false,
  });

  return (
    <section
      aria-labelledby="settings-configuration-heading"
      className="space-y-3"
    >
      <div>
        <p className="atlas-eyebrow mb-2">Configuration</p>
        <h2
          id="settings-configuration-heading"
          className="text-xl font-semibold"
        >
          How is RepoAtlas configured?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only. Deployment configuration is changed outside the app.
          Secrets are never shown, only whether they are set.
        </p>
      </div>

      {query.isPending ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Settings unavailable</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              {parseAtlasError(query.error)?.message ??
                atlasErrorMessage("SETTINGS_UNAVAILABLE")}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <ConfigurationList
          items={query.data.items}
          preferences={{ autoRotate, showRelationships }}
        />
      )}
    </section>
  );
}
