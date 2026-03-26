"use strict";

const { metricKeys, metricsConfig, stories, initialState } = window.STORY_DATA;

const stage = document.getElementById("stage");
const stageContent = document.getElementById("stage-content");
const pageProgress = document.getElementById("page-progress");
const metricsContainer = document.getElementById("metrics");
const guidanceBox = document.getElementById("guidance");
const historyList = document.getElementById("history-list");
const homeGhost = document.getElementById("home-ghost");
const restartGhost = document.getElementById("restart-ghost");
const endingModal = document.getElementById("ending-modal");
const endingTitle = document.getElementById("ending-title");
const endingBody = document.getElementById("ending-body");
const endingSummary = document.getElementById("ending-summary");
const restartButton = document.getElementById("restart-button");

let state = initialState();
let isTransitioning = false;

function getCurrentStory() {
  return state.subjectId ? stories[state.subjectId] : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function metricPercent(config, value) {
  if (value === null || value === undefined) {
    return 0;
  }
  const ratio = (value - config.min) / (config.max - config.min);
  const normalized = clamp(ratio, 0, 1);
  const adjusted = config.reversed ? 1 - normalized : normalized;
  return adjusted * 100;
}

function renderMetrics() {
  metricsContainer.innerHTML = "";
  metricsConfig.forEach((metric) => {
    const value = state[metric.key];
    const item = document.createElement("div");
    item.className = "metric";
    item.innerHTML = `
      <div class="metric-row">
        <span class="metric-label">${metric.label}</span>
        <span class="metric-value">${value === null ? "--" : value}</span>
      </div>
      <div class="metric-bar">
        <div class="metric-fill" style="width:${metricPercent(metric, value)}%; background:${metric.color};"></div>
      </div>
    `;
    metricsContainer.appendChild(item);
  });
}

function renderHistory() {
  historyList.innerHTML = "";
  if (state.history.length === 0) {
    const item = document.createElement("li");
    item.textContent = state.subjectId ? "尚未做出任何决策。" : "选择业务主体后，这里会记录你的决策轨迹。";
    historyList.appendChild(item);
    return;
  }

  state.history.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = `${entry.round}：${entry.choice}。${entry.summary}`;
    historyList.appendChild(item);
  });
}

function getCurrentRound() {
  const story = getCurrentStory();
  if (!story || state.roundIndex < 0 || state.roundIndex >= story.rounds.length) {
    return null;
  }
  return story.rounds[state.roundIndex];
}

function renderSidebar() {
  renderMetrics();
  renderHistory();

  if (!state.subjectId) {
    guidanceBox.textContent = "先选择一个业务主体。重点看它属于什么行业、核心利润压力来自哪里，以及哪些流程天然更适合标准化、辅助提效或自动执行。";
    homeGhost.classList.add("hidden");
    restartGhost.classList.add("hidden");
    pageProgress.textContent = "Business Directory";
    return;
  }

  const story = getCurrentStory();
  homeGhost.classList.remove("hidden");

  if (state.roundIndex < 0) {
    guidanceBox.textContent = `你当前选择的是“${story.name}”。先读清行业背景和经营压力，再进入第一关。`;
    restartGhost.classList.add("hidden");
    pageProgress.textContent = "Story Brief";
    return;
  }

  if (state.roundIndex >= story.rounds.length) {
    guidanceBox.textContent = "挑战已完成。回看你的决策轨迹，重点看你在速度、控制、组织接受度和风险之间是如何取舍的。";
    restartGhost.classList.remove("hidden");
    pageProgress.textContent = "Outcome Ready";
    return;
  }

  guidanceBox.textContent = getCurrentRound().hint;
  restartGhost.classList.remove("hidden");
  pageProgress.textContent = `Round ${state.roundIndex + 1} / ${story.rounds.length}`;
}

function renderHomeScreen() {
  const cards = Object.values(stories)
    .map((story) => `
      <button class="subject-card" type="button" data-subject-id="${story.id}">
        <div class="subject-topline">
          <div class="subject-name">${story.name}</div>
          <span class="subject-tag">${story.durationLabel}</span>
        </div>
        <div class="subject-desc">${story.homeSummary}</div>
        <div class="subject-meta">
          <span class="subject-pill">${story.industry}</span>
          <span>${story.homeTag}</span>
        </div>
        <div class="subject-meta">
          <span>${story.company}</span>
          <span>8关闯关模式</span>
        </div>
      </button>
    `)
    .join("");

  stageContent.innerHTML = `
    <div class="home-layout">
      <div class="cover-kicker">5个业务主体，5条独立故事线</div>
      <div class="cover-body">
        <div class="home-copy">
          <div>
            <p class="eyebrow">Business Story Directory</p>
            <h1>选择一个业务主体开始挑战</h1>
          </div>
          <p>
            你将进入 5 个不同行业的数字化转型场景：冷链配送、连锁旅宿、电商运营、医疗服务和离散制造。
            每个业务主体都有独立的行业背景、8 轮经营决策和多结局。先选一个，再进入对应公司的转型战场。
          </p>
        </div>
        <div class="cover-brief">
          <div class="brief-card">
            <span class="brief-label">学习目标</span>
            <div class="brief-value">比较不同业务中，哪些问题适合标准流程，哪些适合人机协同，哪些才值得自动执行</div>
          </div>
          <div class="brief-card">
            <span class="brief-label">共同规则</span>
            <div class="brief-value">你的选择会直接改写预算、时间、成本、利润、风险与接受度</div>
          </div>
          <div class="brief-card">
            <span class="brief-label">进入方式</span>
            <div class="brief-value">点击任一业务主体卡片，先查看行业背景，再开始闯关</div>
          </div>
        </div>
      </div>
      <div class="subject-grid">${cards}</div>
      <div class="home-actions">
        <p class="home-tip">建议至少体验两个行业，对比相同数字化手段在不同行业中为什么收益与风险完全不同。</p>
        <div class="subject-pill">主页选择模式</div>
      </div>
    </div>
  `;

  stageContent.querySelectorAll("[data-subject-id]").forEach((button) => {
    button.addEventListener("click", () => selectSubject(button.dataset.subjectId));
  });
}

function renderSubjectCover(story) {
  const cards = story.coverCards
    .map((card) => `
      <div class="brief-card">
        <span class="brief-label">${card.label}</span>
        <div class="brief-value">${card.value}</div>
      </div>
    `)
    .join("");

  stageContent.innerHTML = `
    <div class="stage-screen cover-screen">
      <div class="cover-kicker">${story.durationLabel}已启动</div>
      <div class="cover-body">
        <div class="cover-copy">
          <div>
            <p class="eyebrow">${story.coverEyebrow}</p>
            <h1>${story.coverTitle}</h1>
          </div>
          <p>${story.coverIntro}</p>
        </div>
        <div class="cover-brief">${cards}</div>
      </div>
      <div class="cover-actions">
        <p class="cover-tip">点击开始后进入第一关。每次决策都会立刻改写经营状态，并切换到下一页。</p>
        <button id="start-button" class="primary-button" type="button">开始挑战</button>
      </div>
    </div>
  `;

  document.getElementById("start-button").addEventListener("click", startGame);
}

function renderRoundScreen(round) {
  const story = getCurrentStory();
  const dialogueHtml = round.dialogue(state)
    .map((item) => `
      <div class="dialogue-item">
        <div class="dialogue-speaker">${item.speaker}</div>
        <div class="dialogue-line">${item.line}</div>
      </div>
    `)
    .join("");

  const optionsHtml = round.options
    .map((option) => `
      <button class="option-card" type="button" data-option-id="${option.id}">
        <div class="option-title">${option.title}</div>
        <div class="option-desc">${option.description}</div>
      </button>
    `)
    .join("");

  stageContent.innerHTML = `
    <div class="stage-screen">
      <div class="round-topline">
        <div>
          <p class="eyebrow">${story.shortName} · ${round.scene}</p>
          <h1 class="round-title">${round.title}</h1>
        </div>
        <div class="scene-pill">第 ${state.roundIndex + 1} / ${story.rounds.length} 关</div>
      </div>
      <p class="round-subtitle">${round.subtitle(state)}</p>
      <div class="story-body">
        <section class="dialogue-panel">
          <div class="panel-heading">
            <span>场景对话</span>
            <span>现场还在继续变化</span>
          </div>
          <div class="dialogue-list">${dialogueHtml}</div>
        </section>
        <section class="options-panel">
          <div class="panel-heading">
            <span>你的决策</span>
            <span>选一条推进路径</span>
          </div>
          <div class="options-list">${optionsHtml}</div>
        </section>
      </div>
      <div class="round-footer">
        <p class="round-note">${round.note}</p>
        <div class="scene-pill">做出选择后自动切换下一关</div>
      </div>
    </div>
  `;

  stageContent.querySelectorAll("[data-option-id]").forEach((button) => {
    button.addEventListener("click", () => handleOptionClick(button.dataset.optionId));
  });
}

function renderCompletedStage() {
  const story = getCurrentStory();
  stageContent.innerHTML = `
    <div class="stage-screen cover-screen">
      <div class="cover-kicker">挑战完成</div>
      <div class="cover-body">
        <div class="cover-copy">
          <div>
            <p class="eyebrow">Outcome Ready</p>
            <h1>${story.name} 的经营结果已经生成</h1>
          </div>
          <p>结果弹窗已经打开。你可以查看最终结局，也可以通过右上角按钮重新开始当前业务主体，或返回主页选择另一家公司。</p>
        </div>
        <div class="cover-brief">
          <div class="brief-card">
            <span class="brief-label">当前利润</span>
            <div class="brief-value">${state.profit}</div>
          </div>
          <div class="brief-card">
            <span class="brief-label">当前风险</span>
            <div class="brief-value">${state.risk}</div>
          </div>
          <div class="brief-card">
            <span class="brief-label">当前预算</span>
            <div class="brief-value">${state.budget}</div>
          </div>
        </div>
      </div>
      <div class="cover-actions">
        <p class="cover-tip">如果要比较不同行业的差异，建议返回主页再体验另一个业务主体。</p>
        <button id="restart-stage-button" class="primary-button" type="button">重新挑战本主体</button>
      </div>
    </div>
  `;

  document.getElementById("restart-stage-button").addEventListener("click", restartCurrentStoryToCover);
}

function render() {
  renderSidebar();
  if (!state.subjectId) {
    renderHomeScreen();
    return;
  }

  const story = getCurrentStory();
  if (state.roundIndex < 0) {
    renderSubjectCover(story);
    return;
  }
  if (state.roundIndex >= story.rounds.length) {
    renderCompletedStage();
    return;
  }
  renderRoundScreen(getCurrentRound());
}

function applyConditionalEffects(round, option, nextState) {
  const extra = { budget: 0, time: 0, cost: 0, profit: 0, risk: 0, adoption: 0 };

  if (round.id === "inventory" && option.workflow === "Agentic" && state.workflowCounts.Agentic >= 1) {
    extra.risk += 6;
    extra.profit -= 2;
  }
  if (round.id === "roi" && option.workflow === "Agentic" && nextState.risk >= 45) {
    extra.risk += 4;
  }
  if (round.id === "adoption" && option.workflow === "AI" && state.adoption < 45) {
    extra.adoption += 4;
    extra.profit += 2;
  }
  if (round.id === "adoption" && option.workflow === "Agentic" && state.adoption < 45) {
    extra.adoption -= 6;
    extra.risk += 4;
  }
  if (round.id === "bigDeal" && option.workflow === "Agentic" && state.risk <= 45) {
    extra.profit += 4;
    extra.time += 1;
  }
  if (round.id === "bigDeal" && option.workflow === "Agentic" && state.risk > 55) {
    extra.risk += 6;
  }
  if (round.id === "incident" && option.workflow === "AI" && state.workflowCounts.AI >= 2) {
    extra.risk -= 2;
    extra.profit += 2;
  }
  if (round.id === "incident" && option.workflow === "Agentic" && state.risk >= 55) {
    extra.risk += 8;
    extra.profit -= 3;
  }
  if (round.id === "finale") {
    if (option.workflow === "SOP" && nextState.time <= 4) {
      extra.profit -= 2;
    }
    if (option.workflow === "AI" && state.workflowCounts.AI >= 3) {
      extra.profit += 4;
      extra.adoption += 2;
    }
    if (option.workflow === "Agentic" && state.workflowCounts.Agentic >= 3 && state.risk < 60) {
      extra.profit += 5;
    }
  }

  Object.entries(extra).forEach(([key, value]) => {
    nextState[key] += value;
  });
}

function evaluateEnding(isFinalRound = false) {
  const story = getCurrentStory();
  if (!story) {
    return null;
  }

  if (state.budget < 0) {
    return { title: `失败结局：${story.shortName}预算崩盘`, body: `你在系统接入、返工、赔付和修复上花得太快，财务直接冻结了项目预算。${story.shortName}还没跑顺，钱已经先烧穿了。` };
  }
  if (state.cost > 120) {
    return { title: `失败结局：${story.shortName}成本失控`, body: `加班、返工、赔付、外包修复和工具费用一起抬头。团队忙得团团转，但${story.shortName}的利润没有真正回来。` };
  }
  if (state.risk >= 80) {
    return { title: `失败结局：${story.shortName}自动化失控`, body: `错误承诺、越权动作和缺乏留痕叠加成治理事故。速度上去了，但${story.shortName}的客户、团队和管理层开始不再信任这套系统。` };
  }
  if (state.time <= 0 && state.profit < 80) {
    return { title: `失败结局：${story.shortName}超时失败`, body: `窗口期已经过去，你没能在关键客户和管理层失去耐心前把利润和现场秩序拉回来。${story.shortName}错过了修复窗口。` };
  }
  if (!isFinalRound) {
    return null;
  }
  if (state.profit >= 110 && state.budget >= 0 && state.risk >= 60 && state.risk < 80 && state.time > 0) {
    return { title: `成功结局：${story.shortName}高增长但高压运行`, body: `你把增长和利润拉了回来，也证明了更强自动执行在${story.industry}场景中的潜力。但治理边界仍偏薄，下一阶段必须先补风控。` };
  }
  if (state.profit >= 100 && state.budget >= 10 && state.risk < 60 && state.time > 0) {
    return { title: `成功结局：${story.shortName}稳健转型成功`, body: `你把标准化、系统辅助和自动执行放在了各自合适的位置。${story.shortName}既稳住了现场，也把利润重新拉回到健康区间。` };
  }
  return { title: `失败结局：${story.shortName}改善不足`, body: `你做了不少优化，但更多是救火式提效，还没有真正改写${story.shortName}的利润结构和经营方式。管理层要求你重做下一阶段路线图。` };
}

function showEnding(result) {
  endingTitle.textContent = result.title;
  endingBody.textContent = result.body;
  endingSummary.textContent = [`预算 ${state.budget}`, `时间 ${state.time}`, `成本 ${state.cost}`, `利润 ${state.profit}`, `风险 ${state.risk}`, `接受度 ${state.adoption}`].join(" | ");
  endingModal.classList.remove("hidden");
}

function transitionTo(nextAction) {
  if (isTransitioning) {
    return;
  }
  isTransitioning = true;
  stage.classList.add("is-switching");

  window.setTimeout(() => {
    nextAction();
    render();
    requestAnimationFrame(() => {
      stage.classList.remove("is-switching");
      isTransitioning = false;
    });
  }, 280);
}

function selectSubject(subjectId) {
  if (!stories[subjectId] || isTransitioning) {
    return;
  }
  endingModal.classList.add("hidden");
  transitionTo(() => {
    state = initialState(subjectId);
  });
}

function startGame() {
  if (isTransitioning || !state.subjectId) {
    return;
  }
  endingModal.classList.add("hidden");
  transitionTo(() => {
    const next = initialState(state.subjectId);
    next.roundIndex = 0;
    state = next;
  });
}

function restartCurrentStoryToCover() {
  if (isTransitioning || !state.subjectId) {
    return;
  }
  endingModal.classList.add("hidden");
  transitionTo(() => {
    state = initialState(state.subjectId);
  });
}

function goHome() {
  if (isTransitioning) {
    return;
  }
  endingModal.classList.add("hidden");
  transitionTo(() => {
    state = initialState();
  });
}

function handleOptionClick(optionId) {
  if (isTransitioning || !state.subjectId || state.roundIndex < 0) {
    return;
  }
  const round = getCurrentRound();
  const option = round.options.find((item) => item.id === optionId);
  if (!option) {
    return;
  }

  transitionTo(() => {
    const nextState = { ...state };
    metricKeys.forEach((key) => {
      nextState[key] += option.effects[key];
    });
    applyConditionalEffects(round, option, nextState);
    nextState.workflowCounts = { ...state.workflowCounts, [option.workflow]: state.workflowCounts[option.workflow] + 1 };
    nextState.roundIndex = state.roundIndex + 1;
    nextState.history = [...state.history, { round: round.title, choice: option.title, summary: option.summary }];
    state = nextState;

    const story = getCurrentStory();
    const ending = evaluateEnding(state.roundIndex >= story.rounds.length);
    if (ending) {
      showEnding(ending);
    }
  });
}

homeGhost.addEventListener("click", goHome);
restartGhost.addEventListener("click", restartCurrentStoryToCover);
restartButton.addEventListener("click", startGame);
endingModal.addEventListener("click", (event) => {
  if (event.target === endingModal) {
    endingModal.classList.add("hidden");
  }
});

render();
