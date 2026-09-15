export function RepoAtlasLogo() {
  return (
    <div className="flex items-center gap-3" aria-label="RepoAtlas">
      <span className="atlas-mark" aria-hidden="true"><i /><i /><i /></span>
      <div>
        <div className="text-lg font-semibold leading-none text-foreground">Repo<span className="text-primary">Atlas</span></div>
        <div className="mt-1 text-[8px] uppercase text-muted-foreground">Explore · Understand · Build</div>
      </div>
    </div>
  );
}
