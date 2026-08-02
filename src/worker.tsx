import { Hono } from "hono";
import type { Context } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";

type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403,
  ) {
    super(message);
  }
}

const origin = "https://saitei-chingin.yhay81.com";
const currentTable =
  "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/minimumichiran/index.html";
const sourcePdf = "https://www.mhlw.go.jp/content/11200000/001571192.pdf";
const faq =
  "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/faq/faq_saiteichingin.html";
const terms = "https://www.mhlw.go.jp/chosakuken/index.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "searched",
  "no_result",
  "region_changed",
  "sort_changed",
  "hours_changed",
  "compared",
  "copied",
]);

const nowSeconds = () => Math.floor(Date.now() / 1000);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (Number(c.req.header("content-length") ?? "0") > 512)
    throw new ApiError("invalid_payload", 400);
  try {
    return await c.req.json<unknown>();
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-saitei-chingin-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-saitei-chingin-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const nav = [
  { href: "/", label: "くらべる" },
  { href: "/guide", label: "数字の見方" },
  { href: "/source", label: "出典" },
  { href: "/privacy", label: "保存" },
];

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width, initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="ja_JP" property="og:locale" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#26354a" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
    </head>
    <body>
      <header class="site-header">
        <a aria-label="最低賃金くらべ ホーム" class="brand" href="/">
          <span aria-hidden="true" class="brand-mark">
            <i />
            <i />
          </span>
          <span>最低賃金くらべ</span>
        </a>
        <nav aria-label="主なページ">
          {nav.map((item) => (
            <a href={item.href}>{item.label}</a>
          ))}
        </nav>
      </header>
      {children}
      <footer>
        <div>
          <strong>最低賃金くらべ</strong>
          <p>厚生労働省「地域別最低賃金の全国一覧」を加工して作成</p>
        </div>
        <div class="footer-links">
          <a href="/source">出典と注意</a>
          <a href="/privacy">保存と計測</a>
          <a href="https://github.com/yhay81/saitei-chingin">ソースコード</a>
        </div>
      </footer>
    </body>
  </html>
);

const WageClockFigure = () => (
  <div aria-label="時給と発効日を示すタイムカード" class="wage-instrument" role="img">
    <div class="clock-face">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
      <span class="clock-hand hour" />
      <span class="clock-hand minute" />
      <span class="clock-pin" />
    </div>
    <div class="pay-ticket">
      <div class="ticket-notch" />
      <p>全国加重平均</p>
      <strong>
        ¥1,121 <small>/ 時間</small>
      </strong>
      <div class="ticket-rule">
        <span>前年度 ¥1,055</span>
        <span>+¥66</span>
      </div>
      <div class="punch-date">
        <span>2025年度版</span>
        <b>47 都道府県</b>
      </div>
    </div>
    <div class="wage-ruler" aria-hidden="true">
      <span>¥1,226</span>
      <i />
      <i />
      <i />
      <i />
      <i />
      <span>¥1,023</span>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="47都道府県の地域別最低賃金を検索し、時間額・前年度からの上げ幅・発効日と、月間時間を掛けた参考額を最大4地域で比較できます。"
    title="47都道府県の最低賃金を比較 | 最低賃金くらべ"
  >
    <main>
      <section class="hero-shell">
        <div class="hero-copy">
          <p class="eyebrow">2025年度 · 地域別最低賃金</p>
          <h1>働く場所の時給を、同じ目盛りで。</h1>
          <p class="lead">
            都道府県を選ぶと、現在の時間額、前年度からの上げ幅、発効日を横に並べられます。
          </p>
          <div aria-label="収録内容" class="hero-facts">
            <span>
              <b>47</b> 都道府県
            </span>
            <span>
              <b>¥1,121</b> 全国加重平均
            </span>
            <span>
              <b>最大4</b> 地域比較
            </span>
          </div>
        </div>
        <WageClockFigure />
      </section>

      <section aria-labelledby="compare-title" class="compare-panel">
        <div class="section-heading compare-heading">
          <div>
            <p class="eyebrow">PAY CLOCK</p>
            <h2 id="compare-title">選んだ地域を並べる</h2>
          </div>
          <div class="hours-field">
            <label for="monthly-hours">月間時間</label>
            <div>
              <input
                id="monthly-hours"
                inputmode="decimal"
                max="250"
                min="1"
                step="1"
                type="number"
                value="160"
              />
              <span>時間</span>
            </div>
          </div>
          <div class="compare-actions">
            <span id="compare-count">0 / 4</span>
            <button disabled id="copy-compare" type="button">
              比較をコピー
            </button>
          </div>
        </div>
        <p class="calculator-note">
          参考額 ＝ 地域別最低賃金の時間額 × 入力時間。税・手当・割増賃金は含みません。
        </p>
        <div class="empty-compare" id="compare-list">
          一覧の「比較に追加」から、2〜4都道府県を選んでください。
        </div>
      </section>

      <section aria-labelledby="finder-title" class="finder">
        <div class="section-heading">
          <div>
            <p class="eyebrow">PREFECTURE INDEX</p>
            <h2 id="finder-title">都道府県を選ぶ</h2>
          </div>
          <p id="data-status" role="status">
            公式表を読み込んでいます
          </p>
        </div>
        <div class="controls">
          <label class="search-field">
            <span>都道府県名</span>
            <input
              autocomplete="off"
              id="search"
              placeholder="例：東京、福岡、沖縄"
              type="search"
            />
          </label>
          <label>
            <span>地域</span>
            <select id="region">
              <option value="all">すべて</option>
            </select>
          </label>
          <label>
            <span>並び順</span>
            <select id="sort">
              <option value="source">都道府県コード順</option>
              <option value="current-desc">時間額が高い順</option>
              <option value="increase-desc">上げ幅が大きい順</option>
              <option value="effective-desc">発効日が新しい順</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-labelledby="results-title" class="results-section">
        <div class="results-heading">
          <h2 id="results-title">地域別最低賃金</h2>
          <p>
            <b id="result-count">—</b> 都道府県
          </p>
        </div>
        <div class="rate-grid" id="results" />
      </section>

      <aside class="boundary">
        <span aria-hidden="true">式</span>
        <div>
          <strong>参考額は、単純な掛け算です</strong>
          <p>
            月給が最低賃金以上かを判定する計算ではありません。通勤・家族・皆勤手当や時間外割増など、算入しない賃金・別計算になる賃金があります。判断には厚生労働省Q&amp;Aや労働局の案内を確認してください。
          </p>
        </div>
      </aside>
    </main>
    <script defer src="/app.js" />
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="地域別最低賃金の適用範囲、派遣労働者、特定最低賃金との関係、参考額の読み方を説明します。"
    title="数字の見方 | 最低賃金くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">READ THE PAY CLOCK</p>
        <h1>見る場所は、時間額と発効日。</h1>
        <p>同じ年度でも、都道府県ごとに新しい時間額が効き始めた日が異なります。</p>
      </div>
      <section class="guide-grid">
        <article class="guide-rate">
          <span>¥ / HOUR</span>
          <h2>職場の都道府県</h2>
          <p>
            地域別最低賃金は、その都道府県内の事業場で働くすべての労働者と使用者に原則適用されます。
          </p>
        </article>
        <article class="guide-dispatch">
          <span>DISPATCH</span>
          <h2>派遣先の地域</h2>
          <p>派遣労働者には、派遣元ではなく派遣先の事業場に適用される最低賃金が基準になります。</p>
        </article>
        <article class="guide-industry">
          <span>HIGHER RATE</span>
          <h2>特定最低賃金との比較</h2>
          <p>地域別と特定（産業別）の両方が当てはまる場合は、高い方の最低賃金が適用されます。</p>
        </article>
        <article class="guide-calc">
          <span>HOURS × RATE</span>
          <h2>参考額は目安</h2>
          <p>
            入力時間との掛け算は地域差をつかむための目安です。月給・日給の法的な比較方法を置き換えません。
          </p>
        </article>
      </section>
      <section class="note-panel">
        <h2>最低賃金との比較に含めない賃金があります</h2>
        <p>
          臨時の賃金、1か月を超える期間ごとの賃金、時間外・休日・深夜の割増部分、精皆勤手当、通勤手当、家族手当などは比較から除外されます。個別判断は公式Q&amp;Aを確認してください。
        </p>
        <a href={faq}>厚生労働省 最低賃金に関するQ&amp;A</a>
      </section>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="最低賃金くらべが利用する厚生労働省の地域別最低賃金一覧、加工内容、確認日、利用条件を示します。"
    title="出典とデータ | 最低賃金くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">SOURCE</p>
        <h1>47都道府県、ひとつの公式表。</h1>
        <p>2025年度（令和7年度）の時間額、前年度額、引上げ額・率、発効日を収録しています。</p>
      </div>
      <section class="source-ledger">
        <div>
          <span>提供元</span>
          <strong>厚生労働省</strong>
          <a href={currentTable}>地域別最低賃金の全国一覧</a>
        </div>
        <div>
          <span>現行確認</span>
          <strong>2026年8月1日</strong>
          <a href={sourcePdf}>2025年度 全国一覧 PDF</a>
        </div>
        <div>
          <span>全国加重平均</span>
          <strong>1,121円 / 時間</strong>
          <a href={faq}>最低賃金に関するQ&amp;A</a>
        </div>
        <div>
          <span>利用条件</span>
          <strong>公共データ利用規約 第1.0版</strong>
          <a href={terms}>厚生労働省の利用規約</a>
        </div>
      </section>
      <section class="prose-section">
        <h2>行った加工</h2>
        <ul>
          <li>都道府県ごとの時間額、前年度額、引上げ額・率、発効年月日をJSONへ転記しました。</li>
          <li>都道府県を9地域に分類し、検索・絞り込み・並べ替えを加えました。</li>
          <li>入力した月間時間と時間額の単純な積を参考額として表示します。</li>
          <li>出典：厚生労働省「地域別最低賃金の全国一覧」を加工して作成。</li>
        </ul>
      </section>
      <section class="prose-section">
        <h2>収録範囲</h2>
        <p>
          地域別最低賃金のみです。特定（産業別）最低賃金、個別の賃金構成、労働時間区分、助成制度は収録していません。発効日以前の期間には、その都道府県の前の時間額が適用されます。
        </p>
      </section>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="最低賃金くらべの端末保存、匿名利用計測、保持期間、追跡拒否への対応を示します。"
    title="保存と計測 | 最低賃金くらべ"
  >
    <main class="text-page">
      <div class="page-intro">
        <p class="eyebrow">PRIVACY</p>
        <h1>選んだ地域は、端末に。</h1>
        <p>検索語、都道府県名、入力時間をサーバーへ記録しません。</p>
      </div>
      <section class="privacy-grid">
        <article>
          <h2>端末に保存</h2>
          <p>
            比較に選んだ公開都道府県IDを最大4件と月間時間をブラウザへ保存します。アカウントは不要です。
          </p>
        </article>
        <article>
          <h2>操作名だけを計測</h2>
          <p>
            訪問、検索、0件、地域・並び順・時間の変更、比較追加、コピーの操作名だけを計測します。
          </p>
        </article>
        <article>
          <h2>35日で削除</h2>
          <p>
            ランダムなセッションIDをSHA-256で変換し、操作名、QA区分、時刻とともにD1へ保存します。
          </p>
        </article>
        <article>
          <h2>追跡拒否を尊重</h2>
          <p>
            Do Not TrackまたはGlobal Privacy
            Controlが有効な場合は計測しません。広告・外部解析・Cookieは使いません。
          </p>
        </article>
      </section>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("requestId", crypto.randomUUID());
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.use(
  "*",
  jsxRenderer(({ children }) => <>{children}</>),
);
app.get("/", (c) => c.html(<HomePage />));
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_payload", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    asOf: "2026-08-01",
    ok: row?.ok === 1,
    prefectures: 47,
    service: "saitei-chingin",
  });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=300,s-maxage=300");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 最低賃金くらべ"
    >
      <main class="text-page">
        <div class="page-intro">
          <p class="eyebrow">404</p>
          <h1>このタイムカードは見つかりません。</h1>
          <p>
            <a href="/">都道府県の比較へ戻る</a>
          </p>
        </div>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.message, requestId: c.get("requestId") }, error.status);
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};

export default app;
