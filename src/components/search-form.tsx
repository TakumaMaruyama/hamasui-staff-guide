type SearchFormProps = {
  defaultValue?: string;
  compact?: boolean;
};

export function SearchForm({ defaultValue = "", compact = false }: SearchFormProps) {
  return (
    <form
      action="/search"
      className={compact ? "search-form search-form--compact" : "search-form"}
      role="search"
    >
      <label htmlFor={compact ? "header-search" : "manual-search"}>
        キーワードから探す
      </label>
      <div className="search-form__row">
        <input
          id={compact ? "header-search" : "manual-search"}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="例：進級基準、緊急時対応"
        />
        <button type="submit">検索</button>
      </div>
    </form>
  );
}
