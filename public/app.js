const MAX_COMPARE = 4;
const COMPARE_KEY = "saitei-chingin:compare:v1";
const HOURS_KEY = "saitei-chingin:hours:v1";
const MIN_RATE = 1023;
const MAX_RATE = 1226;

const search = document.querySelector("#search");
const region = document.querySelector("#region");
const sort = document.querySelector("#sort");
const monthlyHours = document.querySelector("#monthly-hours");
const results = document.querySelector("#results");
const resultCount = document.querySelector("#result-count");
const dataStatus = document.querySelector("#data-status");
const compareList = document.querySelector("#compare-list");
const compareCount = document.querySelector("#compare-count");
const copyCompare = document.querySelector("#copy-compare");

let rates = [];
let selected = loadSelected();
let searchTimer;
let hoursTimer;
let noResultReported = false;

const isPrivacyEnabled = () =>
  navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
const isQa = () => navigator.webdriver === true || new URLSearchParams(location.search).has("qa");
const getSession = () => {
  const key = "saitei-chingin:session:v1";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
};
const track = (name) => {
  if (isPrivacyEnabled()) return;
  fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-saitei-chingin-session": getSession(),
      "x-saitei-chingin-qa": isQa() ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};

function loadSelected() {
  try {
    const value = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((id) => typeof id === "string").slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}
function saveSelected() {
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(selected));
  } catch {
    // Comparison still works for this page view when storage is unavailable.
  }
}
function loadHours() {
  try {
    const value = Number(localStorage.getItem(HOURS_KEY));
    return Number.isFinite(value) && value >= 1 && value <= 250 ? value : 160;
  } catch {
    return 160;
  }
}
function saveHours(value) {
  try {
    localStorage.setItem(HOURS_KEY, String(value));
  } catch {
    // The current calculation remains usable without persistence.
  }
}

const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase("ja").replaceAll(/\s/gu, "");
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const number = new Intl.NumberFormat("ja-JP");
const date = (value) =>
  new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(
    new Date(`${value}T00:00:00+09:00`),
  );
const getHours = () => {
  const value = Number(monthlyHours.value);
  return Number.isFinite(value) && value >= 1 && value <= 250 ? value : null;
};
const referenceAmount = (rate) => {
  const hours = getHours();
  return hours === null ? "—" : `${number.format(Math.round(rate * hours))}円`;
};

function wageBar(item, label) {
  const width = Math.max(4, ((item.current - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100);
  const previous = Math.max(0, ((item.previous - MIN_RATE) / (MAX_RATE - MIN_RATE)) * 100);
  return `<svg aria-label="${escapeHtml(label)}" class="wage-bar" preserveAspectRatio="none" role="img" viewBox="0 0 100 18">
    <rect class="wage-track" height="8" rx="4" width="100" x="0" y="5"></rect>
    <rect class="wage-fill" height="8" rx="4" width="${width.toFixed(2)}" x="0" y="5"></rect>
    <line class="previous-marker" x1="${previous.toFixed(2)}" x2="${previous.toFixed(2)}" y1="2" y2="16"></line>
    <title>${escapeHtml(label)}。前年度 ${number.format(item.previous)}円</title>
  </svg>`;
}

function renderCompare() {
  const selectedRates = selected.map((id) => rates.find((item) => item.id === id)).filter(Boolean);
  compareCount.textContent = `${selectedRates.length} / ${MAX_COMPARE}`;
  copyCompare.disabled = selectedRates.length === 0;
  if (selectedRates.length === 0) {
    compareList.className = "empty-compare";
    compareList.textContent = "一覧の「比較に追加」から、2〜4都道府県を選んでください。";
    return;
  }
  compareList.className = "compare-list";
  compareList.innerHTML = selectedRates
    .map(
      (item) => `<article class="compare-row">
        <div class="compare-place"><span>${escapeHtml(item.region)}</span><strong>${escapeHtml(item.prefecture)}</strong></div>
        <div class="compare-rate"><strong>¥${number.format(item.current)}</strong><span>/ 時間</span>${wageBar(item, `${item.prefecture} ${number.format(item.current)}円`)}</div>
        <dl class="compare-stats">
          <div><dt>上げ幅</dt><dd>+¥${number.format(item.increase)} <small>${item.increasePercent.toFixed(1)}%</small></dd></div>
          <div><dt>発効日</dt><dd>${date(item.effective)}</dd></div>
          <div><dt>${escapeHtml(monthlyHours.value || "—")}時間の参考</dt><dd>${referenceAmount(item.current)}</dd></div>
        </dl>
        <button aria-label="${escapeHtml(item.prefecture)}を比較から外す" class="remove-button" data-remove="${item.id}" type="button">×</button>
      </article>`,
    )
    .join("");
}

function visibleRates() {
  const term = normalize(search.value);
  const selectedRegion = region.value;
  const filtered = rates.filter((item) => {
    const haystack = normalize(`${item.prefecture}${item.region}`);
    return (
      (!term || haystack.includes(term)) &&
      (selectedRegion === "all" || item.region === selectedRegion)
    );
  });
  const sorted = [...filtered];
  if (sort.value === "current-desc")
    sorted.sort((a, b) => b.current - a.current || a.id.localeCompare(b.id));
  if (sort.value === "increase-desc")
    sorted.sort((a, b) => b.increase - a.increase || a.id.localeCompare(b.id));
  if (sort.value === "effective-desc")
    sorted.sort((a, b) => b.effective.localeCompare(a.effective) || a.id.localeCompare(b.id));
  return sorted;
}

function renderResults() {
  const visible = visibleRates();
  resultCount.textContent = number.format(visible.length);
  if (visible.length === 0) {
    results.innerHTML =
      '<div class="no-results"><span>0</span><h3>一致する都道府県がありません</h3><p>都道府県名を短くするか、地域を「すべて」に戻してください。</p></div>';
    if (!noResultReported) {
      noResultReported = true;
      track("no_result");
    }
    return;
  }
  noResultReported = false;
  results.innerHTML = visible
    .map((item) => {
      const active = selected.includes(item.id);
      const disabled = !active && selected.length >= MAX_COMPARE;
      return `<article class="rate-card">
        <div class="rate-heading"><div><p>${escapeHtml(item.region)} · ${escapeHtml(item.id)}</p><h3>${escapeHtml(item.prefecture)}</h3></div><strong>¥${number.format(item.current)}<small>/ 時間</small></strong></div>
        ${wageBar(item, `${item.prefecture}の時間額 ${number.format(item.current)}円`)}
        <div class="scale-labels"><span>¥${number.format(MIN_RATE)}</span><span>¥${number.format(MAX_RATE)}</span></div>
        <dl class="rate-meta">
          <div><dt>前年度</dt><dd>¥${number.format(item.previous)}</dd></div>
          <div><dt>上げ幅</dt><dd>+¥${number.format(item.increase)} <small>${item.increasePercent.toFixed(1)}%</small></dd></div>
          <div><dt>発効日</dt><dd>${date(item.effective)}</dd></div>
        </dl>
        <button class="compare-button${active ? " is-selected" : ""}" data-select="${item.id}" ${disabled ? "disabled" : ""} type="button">${active ? "比較中" : disabled ? "4地域を選択済み" : "比較に追加"}</button>
      </article>`;
    })
    .join("");
}

function toggleSelected(id) {
  if (selected.includes(id)) selected = selected.filter((item) => item !== id);
  else if (selected.length < MAX_COMPARE) {
    selected = [...selected, id];
    track("compared");
  }
  saveSelected();
  renderCompare();
  renderResults();
}

results.addEventListener("click", (event) => {
  const button = event.target.closest("[data-select]");
  if (button) toggleSelected(button.dataset.select);
});
compareList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (button) toggleSelected(button.dataset.remove);
});
search.addEventListener("input", () => {
  renderResults();
  clearTimeout(searchTimer);
  if (search.value.trim()) searchTimer = setTimeout(() => track("searched"), 650);
});
region.addEventListener("change", () => {
  renderResults();
  track("region_changed");
});
sort.addEventListener("change", () => {
  renderResults();
  track("sort_changed");
});
monthlyHours.addEventListener("input", () => {
  const hours = getHours();
  if (hours !== null) saveHours(hours);
  renderCompare();
  clearTimeout(hoursTimer);
  hoursTimer = setTimeout(() => track("hours_changed"), 650);
});
monthlyHours.addEventListener("blur", () => {
  if (getHours() === null) monthlyHours.value = String(loadHours());
  renderCompare();
});
copyCompare.addEventListener("click", async () => {
  const hours = getHours();
  const lines = selected
    .map((id) => rates.find((item) => item.id === id))
    .filter(Boolean)
    .map(
      (item) =>
        `${item.prefecture}｜${number.format(item.current)}円/時間｜前年度比 +${number.format(item.increase)}円｜発効 ${date(item.effective)}${hours === null ? "" : `｜${number.format(hours)}時間の単純計算 ${number.format(Math.round(item.current * hours))}円`}`,
    );
  await navigator.clipboard.writeText(
    [
      "地域別最低賃金 比較（2025年度版・2026年8月1日現行確認）",
      ...lines,
      "参考額は時間額×入力時間の単純計算。最低賃金適合の判定には使えません。",
      "出典：厚生労働省「地域別最低賃金の全国一覧」",
    ].join("\n"),
  );
  copyCompare.textContent = "コピーしました";
  setTimeout(() => {
    copyCompare.textContent = "比較をコピー";
  }, 1600);
  track("copied");
});

monthlyHours.value = String(loadHours());
fetch("/data/rates.json")
  .then((response) => {
    if (!response.ok) throw new Error("data_unavailable");
    return response.json();
  })
  .then((data) => {
    rates = data;
    const validIds = new Set(rates.map((item) => item.id));
    selected = selected.filter((id) => validIds.has(id));
    saveSelected();
    const regions = [...new Set(rates.map((item) => item.region))];
    region.insertAdjacentHTML(
      "beforeend",
      regions
        .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
        .join(""),
    );
    dataStatus.textContent = "47都道府県 · 2025年度版 · 2026年8月1日現行確認";
    renderCompare();
    renderResults();
    track("visited");
  })
  .catch(() => {
    dataStatus.textContent = "データを読み込めませんでした。再読み込みしてください。";
    results.innerHTML =
      '<div class="no-results"><h3>公式表を表示できません</h3><p>通信状態を確認して、ページを再読み込みしてください。</p></div>';
  });
