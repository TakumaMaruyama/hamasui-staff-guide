# はまスイ スタッフガイド

「夢中と挑戦を、未来へ。」というはまスイのコンセプトのもと、はまだスイミングスクールのスタッフが指導・安全・運営の基準をすばやく確認するための閲覧専用Webアプリです。

## 正本とアプリの役割

- **Notion**：管理者がマニュアルを作成・編集する唯一の正本（Single Source of Truth）
- **このWebアプリ**：Notion公式APIで取得した内容を、スタッフ向けに検索・階層化して表示する閲覧専用インターフェース

このアプリからマニュアル本文を編集・保存することはできません。本文をAIやアプリ側で要約、改変、補足もしません。Notionの公開ページをスクレイピングせず、Notion公式SDK/APIをサーバー側から使用します。Notionトークンなどの秘密情報をブラウザへ渡したり、ログへ出力したりしないでください。

## 技術要件

- Next.js（App Router）
- TypeScript（strict）
- Tailwind CSS
- Notion公式SDK（`@notionhq/client`）
- Node.js `>=22.13.0`、npm

## 環境変数

ルートの`.env.example`を`.env.local`へコピーし、値を設定します。秘密情報はGitHubへコミットせず、本番環境ではReplit Secretsへ登録します。

| 変数 | 用途 |
| --- | --- |
| `NOTION_TOKEN` | Notion integrationのアクセストークン（サーバー専用） |
| `NOTION_ROOT_PAGE_ID` | 取得を開始するNotionルートページID |
| `NEXT_PUBLIC_SITE_NAME` | 画面に表示するサイト名 |

対象のルートページIDはソースコードへ固定せず、環境ごとに`NOTION_ROOT_PAGE_ID`で設定してください。

## Notion integrationの準備

1. Notionの「Settings」から「Connections」または「My integrations」を開き、Internal integrationを作成します。
2. 発行されたトークンを`NOTION_TOKEN`へ設定します。トークンはパスワードと同じように扱い、リポジトリ・画面・ログへ出しません。
3. 取得対象のルートページを開き、ページメニューの「Connections」から作成したintegrationを追加（共有）します。子ページも同じツリー配下に置き、必要なページへのアクセス権を付与してください。
4. ルートページIDを`NOTION_ROOT_PAGE_ID`へ設定します。

## ローカル開発

```bash
cp .env.example .env.local
# .env.localへ3つの値を設定
npm install
npm run dev
```

ブラウザで`http://localhost:3000`を開きます。ローカル環境にはアプリ独自のログイン画面はありません。提出前・デプロイ前には次も実行してください。

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

## GitHubへの保存

アプリのソースコードはGitHubリポジトリで管理します。`.env`、`.env.local`、その他の環境別秘密ファイルはコミットしません。コミット前に次を確認してください。

```bash
git status
git diff --check
git ls-files | rg '(^|/)\.env'
```

最後のコマンドには`.env.example`だけが表示される状態にします。トークンやパスワードが誤ってコミットされた場合は、値を即時失効・再発行し、Git履歴からの除去も行ってください。

## Replitへの取り込みと起動

1. ReplitでGitHubリポジトリをImportします。
2. ReplitのSecretsまたは構成に、`.env.example`の3変数を登録します。`NOTION_TOKEN`は必ずSecretとして扱い、ソースコードや通常の環境変数ファイルへ貼り付けないでください。
3. Node.js環境で依存関係をインストールし、Build commandを`npm run build`、Run commandを`npm run start`にします。
4. DeploymentのVisibilityを必ず**Private**にします。アプリ独自のログイン機能はなく、公開環境のアクセス制御はReplitのReplShieldへ委ねます。Publicへ変更するとアプリ側では閲覧を拒否できません。
5. 本番運用は再起動・スケールでメモリキャッシュが消えるため、常時稼働できる**Reserved VM（推奨）**を使用します。
6. サーバーはReplitの`PORT`を使い、`0.0.0.0`で待ち受けます。`package.json`の`dev`と`start`はこの設定に対応しています。固定ポートや`localhost` bindに変更しないでください。

デプロイ後、Replit未認証のアクセスがReplShieldへ誘導されること、許可されたReplitユーザーにはアプリが直接表示されること、検索、Notion本文・画像表示を確認します。ReplShieldの307とアプリ自身の応答を混同しないでください。ReplitのBuild成功だけでは、実際に公開されたURLの表示まで確認できたことにはなりません。

## 更新の反映とキャッシュ

Notionを編集した内容は、通常は5〜10分程度のメモリキャッシュ後に反映されます。詳細画面またはトップ画面の「更新を確認」で手動再取得できます。短時間の連打は簡易レート制限の対象です。再取得に失敗した場合は、利用できる既存キャッシュを表示し続けます。

初期版はWebhookや永続データベースを使用しません。Replitの再起動・複数インスタンス化でメモリキャッシュが消えるため、その後はNotionから再取得します。Notion画像URLは期限付きのため、通常は5分のスナップショット更新で新しいURLへ入れ替えます。Notion障害中に古い本文を表示している場合、期限切れ画像は再利用できず、画面には画像の代わりに案内を表示します。

## 障害時の確認

| 症状 | 主な確認箇所 |
| --- | --- |
| 401 Unauthorized | `NOTION_TOKEN`の誤り・失効。integrationを再作成またはトークンを再発行し、Secretsを更新 |
| 403 Forbidden | integrationがルートページまたは対象子ページに共有されているか、権限があるか |
| 404 Not Found | `NOTION_ROOT_PAGE_ID`の値・形式・対象ページの削除や移動 |
| 429 Too Many Requests | 連打やAPI制限。`Retry-After`を尊重し、時間を置いて再試行。無限リトライはしない |
| 500番台・接続エラー・タイムアウト | Notion/Replitの状態、外向き通信、Secrets、URLを確認。一時的な場合は少数回の指数バックオフ後に既存キャッシュを利用 |
| 公開URLがReplitへ307転送される | Private DeploymentのReplShieldによる認証誘導か確認。許可済みユーザーはReplitへログインしてから再試行 |

エラーログにはトークンなどの秘密値を含めません。401/403/404は設定や共有状態を直してから再取得し、429や一時的な接続障害だけを短時間再試行します。

## 秘密値のローテーション

- **Notion token**：Notion integrationで新しいトークンを発行し、Replit Secretsの`NOTION_TOKEN`を更新してから旧トークンを失効させます。ローカルの`.env.local`も更新します。

値の変更後は再デプロイまたはプロセス再起動を行い、ReplShield通過後の表示とNotion取得を手動確認します。

## 初期版で対応しないもの

Webhook、Notion以外からの編集、スタッフ個別アカウント、既読管理、理解度テスト、コメント、プッシュ通知、AI自動要約、永続データベース、複雑な権限管理、PWA、オフライン対応、画像内文字のOCRは初期版の対象外です。

## デプロイ後の手動確認項目

- DeploymentのVisibilityがPrivateである
- Replit未認証・未許可の利用者がReplShieldへ誘導され、アプリへ直接到達できない
- Replitで許可された利用者にはアプリが直接表示され、アプリ独自のログイン画面へ移動しない
- スマートフォン幅でホーム、検索、安全、全マニュアルへ移動できる
- タイトル・見出し・本文・パンくずを日本語で検索できる
- Notionの子ページ、見出し、箇条書き、画像、リンクが表示される
- パンくず、目次、最終更新日、関連ページが表示される
- 「更新を確認」でNotionの変更が反映され、失敗時も既存表示が残る
- 401/403/404/429・接続エラー時に画面がクラッシュせず、秘密値が画面やログに出ない
- `robots.txt`とmeta robotsがクローラーを拒否する
- `npm run lint`、`npm run typecheck`、`npm run build`、`npm test`が成功する
