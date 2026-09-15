// Generic error reporter. Extend with Sentry / Highlight.io / Datadog as needed.

export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
): void {
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);

  console.error("[RepoAtlas Error]", message, context);

  // TODO: forward to your observability provider, e.g.:
  // Sentry.captureException(error, { extra: context });
}
