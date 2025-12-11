const API_BASE = "https://api.frankfurter.app";
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const fromCountryText     = $("#fromCountryText");
const fromCurrencyText    = $("#fromCurrencyText");
const toCountryText       = $("#toCountryText");
const toCurrencyText      = $("#toCurrencyText");
const amountInput         = $("#amountInput");
const amountCurrencyLabel = $("#amountCurrencyLabel");
const convertBtn          = $("#convertBtn");
const swapBtn             = $("#swapBtn");
const statusMessage       = $("#statusMessage");
const conversionResult    = $("#conversionResult");
const conversionRate      = $("#conversionRate");

let selectedFrom = null;
let selectedTo   = null;
let historyChart = null;

document.addEventListener("DOMContentLoaded", () => {
  $$(".country-pin").forEach(pin => {
    pin.addEventListener("click", () => handleCountryClick(pin));
  });
  convertBtn.addEventListener("click", handleConvert);
  swapBtn.addEventListener("click", handleSwap);
  updateSelectionDisplay();
});

function handleCountryClick(pin) {
  const country  = pin.dataset.country;
  const currency = pin.dataset.currency;

  if (!selectedFrom || (selectedFrom && selectedTo)) {
    selectedFrom = { country, currency };
    selectedTo = null;
  } else if (!selectedTo && country !== selectedFrom.country) {
    selectedTo = { country, currency };
  } else if (country === selectedFrom.country) {
    selectedFrom = { country, currency };
    selectedTo = null;
  }

  highlightSelectedPins();
  updateSelectionDisplay();

  if (selectedFrom && selectedTo) {
    if (!amountInput.value || Number(amountInput.value) <= 0) amountInput.value = 1;
    handleConvert();
  }
}

function highlightSelectedPins() {
  $$(".country-pin").forEach(pin => {
    pin.classList.remove("selected-from", "selected-to");
    if (selectedFrom && pin.dataset.country === selectedFrom.country)
      pin.classList.add("selected-from");
    if (selectedTo && pin.dataset.country === selectedTo.country)
      pin.classList.add("selected-to");
  });
}

function updateSelectionDisplay() {
  if (selectedFrom) {
    fromCountryText.textContent     = selectedFrom.country;
    fromCurrencyText.textContent    = selectedFrom.currency;
    amountCurrencyLabel.textContent = selectedFrom.currency;
  } else {
    fromCountryText.textContent     = "—";
    fromCurrencyText.textContent    = "—";
    amountCurrencyLabel.textContent = "—";
  }

  if (selectedTo) {
    toCountryText.textContent  = selectedTo.country;
    toCurrencyText.textContent = selectedTo.currency;
  } else {
    toCountryText.textContent  = "—";
    toCurrencyText.textContent = "—";
  }
}

function handleSwap() {
  if (!selectedFrom || !selectedTo) {
    statusMessage.textContent = "Pick both countries first.";
    return;
  }
  [selectedFrom, selectedTo] = [selectedTo, selectedFrom];
  highlightSelectedPins();
  updateSelectionDisplay();
  handleConvert();
}

async function handleConvert() {
  if (!selectedFrom || !selectedTo) {
    statusMessage.textContent = "Select both a FROM and TO country.";
    return;
  }

  const amount = parseFloat(amountInput.value);
  if (isNaN(amount) || amount <= 0) {
    statusMessage.textContent = "Enter a valid amount.";
    return;
  }

  const from = selectedFrom.currency;
  const to   = selectedTo.currency;

  try {
    statusMessage.textContent   = "Converting...";
    conversionResult.textContent = "";
    conversionRate.textContent   = "";

    const { rate, result } = await convertCurrency(from, to, amount);

    conversionResult.textContent = `${amount.toFixed(2)} ${from} = ${result.toFixed(2)} ${to}`;
    conversionRate.textContent   = `1 ${from} = ${rate.toFixed(4)} ${to}`;
    statusMessage.textContent    = "";

    loadHistory(from, to);
  } catch (err) {
    statusMessage.textContent = err.message || "Conversion error.";
  }
}

async function convertCurrency(from, to, amount) {
  const url = `${API_BASE}/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const rate = data.rates?.[to];
  if (typeof rate !== "number") throw new Error("Rate not available.");

  return { rate, result: amount * rate };
}

async function loadHistory(baseCurrency, targetCurrency) {
  const end   = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  const startStr = formatDate(start);
  const endStr   = formatDate(end);
  const url =
    `${API_BASE}/${startStr}..${endStr}` +
    `?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(targetCurrency)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data   = await res.json();
    const dates  = Object.keys(data.rates).sort();
    const values = dates.map(d => data.rates[d][targetCurrency]);
    renderHistoryChart(dates, values, baseCurrency, targetCurrency);
  } catch (e) {
    console.warn("History error", e);
  }
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function renderHistoryChart(labels, values, baseCurrency, targetCurrency) {
  const canvas = document.getElementById("historyChart");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");
  if (historyChart) historyChart.destroy();

  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: `1 ${baseCurrency} in ${targetCurrency}`, data: values, fill: false, tension: 0.25 }]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { beginAtZero: false }
      }
    }
  });
}
