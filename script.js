const CHINAMONEY_HISTORY_URL = "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-ccpr/CcprHisNew";
const CHINAMONEY_READ_PREFIX = "https://r.jina.ai/http://r.jina.ai/http://";
const FRANKFURTER_BASE = "https://api.frankfurter.app";
const CURRENCY_API_BASE = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";

const priorityCodes = [
  "CNY", "USD", "EUR", "JPY", "HKD", "GBP", "AUD", "CAD", "CHF", "SGD",
  "THB", "VND", "TWD", "KES", "TZS", "MOP", "MYR", "KRW", "AED", "SAR",
  "RUB", "ZAR", "MXN", "NZD"
];

const fallbackCodes = [
  "BRL", "INR", "IDR", "PHP", "DKK", "SEK", "NOK", "PLN", "HUF", "TRY",
  "CZK", "RON", "ILS", "AED", "SAR", "KES", "TZS", "VND", "TWD"
];

const currencyNames = {
  CNY: "人民币",
  USD: "美元",
  EUR: "欧元",
  JPY: "日元",
  HKD: "港币",
  GBP: "英镑",
  AUD: "澳元",
  CAD: "加拿大元",
  CHF: "瑞士法郎",
  SGD: "新加坡元",
  THB: "泰铢",
  VND: "越南盾",
  TWD: "新台币",
  KES: "肯尼亚先令",
  TZS: "坦桑尼亚先令",
  MOP: "澳门元",
  MYR: "马来西亚林吉特",
  KRW: "韩元",
  AED: "阿联酋迪拉姆",
  SAR: "沙特里亚尔",
  RUB: "俄罗斯卢布",
  ZAR: "南非兰特",
  MXN: "墨西哥比索",
  NZD: "新西兰元",
  HUF: "匈牙利福林",
  PLN: "波兰兹罗提",
  DKK: "丹麦克朗",
  SEK: "瑞典克朗",
  NOK: "挪威克朗",
  TRY: "土耳其里拉",
  BRL: "巴西雷亚尔",
  INR: "印度卢比",
  IDR: "印尼盾",
  PHP: "菲律宾比索",
  CZK: "捷克克朗",
  RON: "罗马尼亚列伊",
  ILS: "以色列新谢克尔"
};

const state = {
  rates: new Map(),
  requestedDate: isoToday(),
  loadingToken: 0
};

const amountInput = document.querySelector("#amountInput");
const rateDate = document.querySelector("#rateDate");
const yearSelect = document.querySelector("#yearSelect");
const monthSelect = document.querySelector("#monthSelect");
const daySelect = document.querySelector("#daySelect");
const fromCurrency = document.querySelector("#fromCurrency");
const toCurrency = document.querySelector("#toCurrency");
const swapButton = document.querySelector("#swapButton");
const resultNumber = document.querySelector("#resultNumber");
const resultValue = document.querySelector(".result-value");
const resultCode = document.querySelector(".result-code");
const resultLabel = document.querySelector("#resultLabel");
const rateLine = document.querySelector("#rateLine");
const sourceBox = document.querySelector("#sourceBox");
const loadStatus = document.querySelector("#loadStatus");

init();

function init() {
  setupDateControls();
  setDateControls(state.requestedDate);
  seedCny();
  renderCurrencyOptions();
  fromCurrency.value = "USD";
  toCurrency.value = "CNY";
  bindEvents();
  loadRatesForDate(state.requestedDate);
}

function bindEvents() {
  [amountInput, fromCurrency, toCurrency].forEach((node) => {
    node.addEventListener("input", updateResult);
    node.addEventListener("change", updateResult);
  });

  rateDate.addEventListener("change", () => {
    const nextDate = normalizeTypedDate(rateDate.value);
    if (!nextDate) {
      rateDate.value = state.requestedDate;
      return;
    }
    setDateControls(nextDate);
    loadRatesForDate(nextDate);
  });

  [yearSelect, monthSelect].forEach((node) => {
    node.addEventListener("change", () => {
      refreshDayOptions();
      const nextDate = dateFromSelects();
      rateDate.value = nextDate;
      loadRatesForDate(nextDate);
    });
  });

  daySelect.addEventListener("change", () => {
    const nextDate = dateFromSelects();
    rateDate.value = nextDate;
    loadRatesForDate(nextDate);
  });

  swapButton.addEventListener("click", () => {
    const oldFrom = fromCurrency.value;
    fromCurrency.value = toCurrency.value;
    toCurrency.value = oldFrom;
    updateResult();
  });

  document.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      fromCurrency.value = button.dataset.quick;
      toCurrency.value = "CNY";
      updateResult();
    });
  });
}

function setupDateControls() {
  const currentYear = Number(isoToday().slice(0, 4));
  const minYear = 2006;
  const yearOptions = [];
  for (let year = currentYear; year >= minYear; year -= 1) {
    yearOptions.push(`<option value="${year}">${year}年</option>`);
  }

  yearSelect.innerHTML = yearOptions.join("");
  monthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return `<option value="${pad2(month)}">${month}月</option>`;
  }).join("");
}

function setDateControls(date) {
  const [year, month, day] = date.split("-");
  rateDate.value = date;
  yearSelect.value = year;
  monthSelect.value = month;
  refreshDayOptions(day);
}

function refreshDayOptions(preferredDay = daySelect.value) {
  const year = Number(yearSelect.value);
  const month = Number(monthSelect.value);
  const days = new Date(year, month, 0).getDate();
  const preferred = Math.min(Number(preferredDay) || 1, days);

  daySelect.innerHTML = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    return `<option value="${pad2(day)}">${day}日</option>`;
  }).join("");
  daySelect.value = pad2(preferred);
}

function dateFromSelects() {
  return `${yearSelect.value}-${monthSelect.value}-${daySelect.value}`;
}

function normalizeTypedDate(value) {
  const match = String(value).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const currentYear = Number(isoToday().slice(0, 4));
  if (year < 2006 || year > currentYear || month < 1 || month > 12) return "";

  const days = new Date(year, month, 0).getDate();
  if (day < 1 || day > days) return "";
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

async function loadRatesForDate(date) {
  const token = ++state.loadingToken;
  state.requestedDate = date;
  state.rates = new Map();
  seedCny();
  setStatus("正在获取汇率", "warn");
  updateResult();

  const [chinaMoney, frankfurter, currencyApi] = await Promise.allSettled([
    loadChinaMoneyHistory(date),
    loadFrankfurter(date),
    loadCurrencyApi(date)
  ]);

  if (token !== state.loadingToken) return;
  if (chinaMoney.status === "fulfilled") applyChinaMoneyHistory(chinaMoney.value, date);
  if (frankfurter.status === "fulfilled") applyFrankfurter(frankfurter.value, date);
  if (currencyApi.status === "fulfilled") applyCurrencyApi(currencyApi.value, date);

  renderCurrencyOptions();
  updateStatus();
  updateResult();
}

function seedCny() {
  state.rates.set("CNY", {
    code: "CNY",
    name: currencyNames.CNY,
    cnyPerUnit: 1,
    date: state.requestedDate,
    requestedDate: state.requestedDate,
    sourceType: "official",
    sourceName: "人民币基准",
    note: "人民币自身换算。"
  });
}

async function loadChinaMoneyHistory(date) {
  const query = `startDate=${date}&endDate=${date}&pageNum=1&pageSize=10`;
  const url = `${CHINAMONEY_HISTORY_URL}?${query}`;
  return fetchJsonFromCandidates([url, `${CHINAMONEY_READ_PREFIX}${url}`], 9000);
}

async function loadFrankfurter(date) {
  return fetchJsonFromCandidates([`${FRANKFURTER_BASE}/${date}?from=CNY`], 7000);
}

async function loadCurrencyApi(date) {
  const candidates = [
    `${CURRENCY_API_BASE}@${date}/v1/currencies/cny.json`,
    `${CURRENCY_API_BASE}@latest/v1/currencies/cny.json`
  ];
  return fetchJsonFromCandidates(candidates, 9000);
}

async function fetchJsonFromCandidates(urls, timeout) {
  let lastError;

  for (const url of urls) {
    try {
      return await fetchJson(url, timeout);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No data source available");
}

async function fetchJson(url, timeout) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return parseJsonText(text);
  } finally {
    window.clearTimeout(timer);
  }
}

function parseJsonText(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw error;
    return JSON.parse(text.slice(start, end + 1));
  }
}

function applyChinaMoneyHistory(data, requestedDate) {
  const head = data.data?.head;
  const values = data.records?.[0]?.values;
  const actualDate = data.records?.[0]?.date || requestedDate;
  if (!Array.isArray(head) || !Array.isArray(values)) return;

  head.forEach((pair, index) => {
    const price = Number(values[index]);
    const code = codeFromPair(pair);
    if (!code || !Number.isFinite(price)) return;

    const cnyPerUnit = normalizeChinaMoneyRate(pair, price);
    if (!Number.isFinite(cnyPerUnit)) return;

    state.rates.set(code, {
      code,
      name: currencyNames[code] || code,
      cnyPerUnit,
      date: actualDate,
      requestedDate,
      sourceType: "official",
      sourceName: "中国货币网人民币汇率中间价",
      note: `来自中国货币网 ${pair}，已统一折算为 1 ${code} 兑人民币。`
    });
  });
}

function codeFromPair(pair) {
  if (pair === "100JPY/CNY") return "JPY";
  if (pair.endsWith("/CNY")) return pair.replace("/CNY", "");
  if (pair.startsWith("CNY/")) return pair.replace("CNY/", "");
  return "";
}

function normalizeChinaMoneyRate(pair, price) {
  if (pair === "100JPY/CNY") return price / 100;
  if (pair.endsWith("/CNY")) return price;
  if (pair.startsWith("CNY/")) return 1 / price;
  return NaN;
}

function applyFrankfurter(data, requestedDate) {
  if (!data.rates) return;
  Object.entries(data.rates).forEach(([code, cnyToCurrency]) => {
    if (state.rates.has(code) || !Number.isFinite(cnyToCurrency) || cnyToCurrency <= 0) return;
    state.rates.set(code, {
      code,
      name: currencyNames[code] || code,
      cnyPerUnit: 1 / cnyToCurrency,
      date: data.date || requestedDate,
      requestedDate,
      sourceType: "fallback",
      sourceName: "Frankfurter / 欧洲央行参考汇率",
      note: "该币种没有使用中国货币网数据，使用 Frankfurter 提供的欧洲央行参考汇率折算。"
    });
  });
}

function applyCurrencyApi(data, requestedDate) {
  const rates = data.cny;
  if (!rates) return;

  fallbackCodes.forEach((code) => {
    const cnyToCurrency = Number(rates[code.toLowerCase()]);
    if (state.rates.has(code) || !Number.isFinite(cnyToCurrency) || cnyToCurrency <= 0) return;
    state.rates.set(code, {
      code,
      name: currencyNames[code] || code,
      cnyPerUnit: 1 / cnyToCurrency,
      date: data.date || requestedDate,
      requestedDate,
      sourceType: "fallback",
      sourceName: "Currency API 第三方历史汇率",
      note: "该币种没有使用中国货币网数据，使用第三方历史汇率，仅作参考。"
    });
  });
}

function renderCurrencyOptions() {
  const selectedFrom = fromCurrency.value || "USD";
  const selectedTo = toCurrency.value || "CNY";
  const codes = sortedCodes();
  const options = codes.map((code) => {
    const rate = state.rates.get(code);
    const marker = rate && rate.sourceType === "fallback" ? " - 非中货币网" : "";
    return `<option value="${code}">${code} ${currencyNames[code] || code}${marker}</option>`;
  }).join("");

  fromCurrency.innerHTML = options;
  toCurrency.innerHTML = options;
  fromCurrency.value = codes.includes(selectedFrom) ? selectedFrom : "USD";
  toCurrency.value = codes.includes(selectedTo) ? selectedTo : "CNY";
}

function sortedCodes() {
  const codes = new Set([...priorityCodes, ...fallbackCodes, ...state.rates.keys()]);
  return [...codes].sort((a, b) => {
    const ai = priorityCodes.indexOf(a);
    const bi = priorityCodes.indexOf(b);
    if (ai !== -1 || bi !== -1) {
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    }
    return a.localeCompare(b);
  });
}

function updateResult() {
  const amount = Number(amountInput.value || 0);
  const from = state.rates.get(fromCurrency.value);
  const to = state.rates.get(toCurrency.value);

  if (!from || !to || !Number.isFinite(amount)) {
    resultValue.textContent = "--";
    resultCode.textContent = "";
    resultLabel.textContent = "换算结果";
    rateLine.textContent = "等待所选日期汇率数据";
    sourceBox.className = "source-box fallback";
    sourceBox.textContent = "请选择日期，系统会优先读取中国货币网该日人民币汇率中间价；没有覆盖的币种会使用备用来源并标注。";
    return;
  }

  const converted = amount * from.cnyPerUnit / to.cnyPerUnit;
  const oneRate = from.cnyPerUnit / to.cnyPerUnit;
  resultValue.textContent = formatMoney(converted);
  resultCode.textContent = to.code;
  resultLabel.textContent = `${formatMoney(amount)} ${from.code} 可换`;
  rateLine.textContent = `1 ${from.code} = ${formatMoney(oneRate)} ${to.code}`;

  const source = sourceForPair(from, to);
  sourceBox.className = `source-box ${source.type}`;
  sourceBox.textContent = source.text;
}

function sourceForPair(from, to) {
  const sources = [from, to].filter((item) => item.code !== "CNY");
  const fallback = sources.find((item) => item.sourceType === "fallback");
  if (fallback) {
    const dateNote = fallback.date === fallback.requestedDate
      ? `日期 ${fallback.date}`
      : `所选日期 ${fallback.requestedDate} 无同日数据，实际使用 ${fallback.date}`;
    return {
      type: "fallback",
      text: `${fallback.code} 使用备用来源：${fallback.sourceName}，${dateNote}。这不是中国货币网人民币汇率中间价数据。`
    };
  }

  const official = sources[0] || from;
  return {
    type: "official",
    text: `来源：${official.sourceName}，汇率日期 ${official.date}。`
  };
}

function updateStatus() {
  const officialCount = [...state.rates.values()].filter((rate) => rate.sourceType === "official").length;
  const fallbackCount = [...state.rates.values()].filter((rate) => rate.sourceType === "fallback").length;
  const hasOfficial = officialCount > 1;
  const label = hasOfficial
    ? `${state.requestedDate} 汇率已更新`
    : `${state.requestedDate} 仅备用汇率`;
  setStatus(label, hasOfficial ? "ready" : "warn");
  if (fallbackCount > 0) {
    loadStatus.title = `中货币网 ${officialCount} 个，备用来源 ${fallbackCount} 个`;
  }
}

function setStatus(text, type) {
  loadStatus.className = `status-pill ${type}`;
  loadStatus.textContent = text;
}

function formatMoney(value) {
  if (!Number.isFinite(value)) return "--";
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 8;
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits
  }).format(value);
}

function isoToday() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}
