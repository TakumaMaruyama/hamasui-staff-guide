import { siteConfig } from "@/src/config/site";

type LoginPageProps = { searchParams: Promise<{ error?: string; returnTo?: string }> };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const siteName = siteConfig.name;
  const returnTo = params.returnTo?.startsWith("/") && !params.returnTo.startsWith("//") ? params.returnTo : "/";
  return (
    <main className="login-page" aria-labelledby="login-title">
      <section className="login-intro">
        <div className="login-brand">
          <span aria-hidden="true">水</span>
          <p>{siteName}</p>
        </div>
        <div>
          <p className="eyebrow">{siteConfig.organization}</p>
          <h1>{siteConfig.concept}</h1>
          <p>{siteConfig.description}</p>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel__inner">
          <p className="eyebrow">スタッフ専用</p>
          <h2 id="login-title">ログイン</h2>
          <p>スタッフ共通パスワードを入力してください。</p>
          {params.error ? (
            <p className="login-error" role="alert">
              {params.error === "rate"
                ? "試行回数が多すぎます。時間を置いて、もう一度お試しください。"
                : "パスワードが正しくありません。もう一度入力してください。"}
            </p>
          ) : null}
          <form method="post" action="/api/auth/login" autoComplete="off">
            <input type="hidden" name="returnTo" value={returnTo} />
            <label htmlFor="password">パスワード</label>
            <input id="password" name="password" type="password" autoComplete="off" required />
            <button type="submit">ログイン</button>
          </form>
          <small>このサイトははまスイスタッフ専用です。</small>
        </div>
      </section>
    </main>
  );
}
