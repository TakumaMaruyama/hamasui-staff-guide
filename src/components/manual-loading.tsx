type ManualLoadingProps = {
  variant?: "home" | "list";
};

export function ManualLoading({ variant = "list" }: ManualLoadingProps) {
  return (
    <div className="manual-loading" aria-busy="true" aria-label="読み込み中">
      {variant === "home" ? <div className="manual-loading__hero" /> : null}
      <div className="manual-loading__line" />
      <div className="manual-loading__line" />
      <div className="manual-loading__block" />
      <div className="manual-loading__block" />
      <span className="sr-only">マニュアルを読み込んでいます。</span>
    </div>
  );
}
