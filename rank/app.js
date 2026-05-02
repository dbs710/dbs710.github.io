const form = document.querySelector("#uploadForm");
const nameInput = document.querySelector("#studentName");
const truthInput = document.querySelector("#truthFile");
const predictionInput = document.querySelector("#predictionFile");
const truthFileName = document.querySelector("#truthFileName");
const predictionFileName = document.querySelector("#predictionFileName");
const statusMessage = document.querySelector("#statusMessage");
const rankingList = document.querySelector("#rankingList");
const emptyState = document.querySelector("#emptyState");
const submissionCount = document.querySelector("#submissionCount");
const clearButton = document.querySelector("#clearButton");
const template = document.querySelector("#rankingTemplate");

const STORAGE_KEY = "prediction-leaderboard-submissions-v2";
let submissions = loadSubmissions();

truthInput.addEventListener("change", () => updateFileLabel(truthInput, truthFileName));
predictionInput.addEventListener("change", () => updateFileLabel(predictionInput, predictionFileName));
clearButton.addEventListener("click", clearSubmissions);
form.addEventListener("submit", handleSubmit);

renderLeaderboard();

function updateFileLabel(input, label) {
  label.textContent = input.files[0]?.name || "选择文件";
}

async function handleSubmit(event) {
  event.preventDefault();
  setStatus("正在读取文件...");

  try {
    const studentName = nameInput.value.trim();
    if (!studentName) {
      throw new Error("请输入学生名字。");
    }

    const truthFile = truthInput.files[0];
    const predictionFile = predictionInput.files[0];
    if (!truthFile || !predictionFile) {
      throw new Error("请同时上传正确答案文件和预测结果文件。");
    }

    const [truthText, predictionText] = await Promise.all([truthFile.text(), predictionFile.text()]);
    const targets = extractLastNumericColumn(truthText, "正确答案文件");
    const predictions = extractLastNumericColumn(predictionText, "预测结果文件");

    if (targets.length !== predictions.length) {
      throw new Error(`两份文件行数不一致：正确答案 ${targets.length} 行，预测结果 ${predictions.length} 行。`);
    }

    const metrics = calculateMetrics(targets, predictions);
    const submission = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name: studentName,
      createdAt: new Date().toISOString(),
      ...metrics,
    };

    submissions.push(submission);
    saveSubmissions();
    renderLeaderboard();
    form.reset();
    updateFileLabel(truthInput, truthFileName);
    updateFileLabel(predictionInput, predictionFileName);
    setStatus(`已添加 ${studentName} 的结果。`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function extractLastNumericColumn(text, label) {
  const rows = parseDelimitedText(text);
  if (!rows.length) {
    throw new Error(`${label}为空。`);
  }

  const startIndex = hasHeader(rows) ? 1 : 0;
  const values = rows.slice(startIndex).map((row, index) => {
    const rawValue = row[row.length - 1]?.trim();
    const value = Number(rawValue);
    if (rawValue === "" || Number.isNaN(value)) {
      throw new Error(`${label}第 ${index + startIndex + 1} 行最后一栏不是数字。`);
    }
    return value;
  });

  if (!values.length) {
    throw new Error(`${label}没有可计算的数据行。`);
  }

  return values;
}

function parseDelimitedText(text) {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];

  const delimiter = detectDelimiter(normalized);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      addRow(rows, row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  addRow(rows, row);
  return rows;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function addRow(rows, row) {
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }
}

function hasHeader(rows) {
  const lastCell = rows[0][rows[0].length - 1]?.trim();
  return lastCell === "" || Number.isNaN(Number(lastCell));
}

function calculateMetrics(targets, predictions) {
  const binaryTargets = targets.map((value, index) => {
    if (value !== 0 && value !== 1) {
      throw new Error(`正确答案第 ${index + 1} 行必须为 0 或 1。`);
    }
    return value;
  });

  const binaryPredictions = predictions.map((value) => (value >= 0.5 ? 1 : 0));
  const positives = binaryTargets.filter((value) => value === 1).length;

  if (positives === 0) {
    throw new Error("正确答案中没有正例，无法计算 PR-AUC 和 Recall。");
  }

  let tp = 0;
  let fp = 0;
  let fn = 0;
  let correct = 0;

  for (let i = 0; i < binaryTargets.length; i += 1) {
    if (binaryTargets[i] === binaryPredictions[i]) correct += 1;
    if (binaryTargets[i] === 1 && binaryPredictions[i] === 1) tp += 1;
    if (binaryTargets[i] === 0 && binaryPredictions[i] === 1) fp += 1;
    if (binaryTargets[i] === 1 && binaryPredictions[i] === 0) fn += 1;
  }

  const accuracy = safeDivide(correct, binaryTargets.length);
  const precision = safeDivide(tp, tp + fp);
  const recall = safeDivide(tp, tp + fn);
  const prAuc = calculatePrauc(binaryTargets, predictions);
  const score = (accuracy + precision + recall + prAuc) / 4;

  return { accuracy, precision, recall, prAuc, score };
}

function calculatePrauc(targets, scores) {
  const positives = targets.filter((value) => value === 1).length;
  const pairs = targets
    .map((target, index) => ({ target, score: scores[index] }))
    .sort((a, b) => b.score - a.score);

  let tp = 0;
  let fp = 0;
  let previousRecall = 0;
  let area = 0;

  for (let i = 0; i < pairs.length; i += 1) {
    const score = pairs[i].score;

    while (i < pairs.length && pairs[i].score === score) {
      if (pairs[i].target === 1) {
        tp += 1;
      } else {
        fp += 1;
      }
      i += 1;
    }
    i -= 1;

    const recall = tp / positives;
    const precision = tp / (tp + fp);
    area += (recall - previousRecall) * precision;
    previousRecall = recall;
  }

  return area;
}

function safeDivide(numerator, denominator) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function renderLeaderboard() {
  const ranked = [...submissions].sort(
    (a, b) =>
      (b.accuracy ?? 0) - (a.accuracy ?? 0) ||
      b.prAuc - a.prAuc ||
      b.precision - a.precision ||
      b.recall - a.recall ||
      b.score - a.score,
  );
  const topAccuracy = ranked[0]?.accuracy || 1;

  rankingList.replaceChildren();
  emptyState.hidden = ranked.length > 0;
  submissionCount.textContent = String(ranked.length);

  ranked.forEach((submission, index) => {
    const row = template.content.firstElementChild.cloneNode(true);
    row.querySelector(".rank-number").textContent = `#${index + 1}`;
    row.querySelector(".rank-name").textContent = submission.name;
    row.querySelector(".rank-score").textContent = `Accuracy ${formatMetric(submission.accuracy ?? 0)}`;
    row.querySelector(".bar-fill").style.width = `${Math.max(5, ((submission.accuracy ?? 0) / topAccuracy) * 100)}%`;
    row.querySelector(".metric-accuracy").textContent = formatMetric(submission.accuracy ?? 0);
    row.querySelector(".metric-prauc").textContent = formatMetric(submission.prAuc);
    row.querySelector(".metric-precision").textContent = formatMetric(submission.precision);
    row.querySelector(".metric-recall").textContent = formatMetric(submission.recall);
    rankingList.append(row);
  });
}

function formatMetric(value) {
  return Number(value).toFixed(3);
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function saveSubmissions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}

function loadSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function clearSubmissions() {
  submissions = [];
  saveSubmissions();
  renderLeaderboard();
  setStatus("排行榜已清空。");
}
