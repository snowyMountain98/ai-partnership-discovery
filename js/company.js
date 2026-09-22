let companies = [];
let analyses = {};

async function loadDetail() {
  try {
    const params = new URLSearchParams(location.search);
    const companyId = params.get("id");

    if (!companyId) {
      renderError("업체 ID가 없습니다.");
      return;
    }

    const [companiesResponse, analysesResponse] = await Promise.all([
      fetch("./data/companies.json"),
      fetch("./data/analyses.json")
    ]);

    if (!companiesResponse.ok || !analysesResponse.ok) {
      throw new Error("분석 데이터를 불러오지 못했습니다.");
    }

    companies = await companiesResponse.json();
    analyses = await analysesResponse.json();

    const company = companies.find(c => String(c.id) === String(companyId));
    if (!company) {
      renderError("해당 업체를 찾을 수 없습니다.");
      return;
    }

    renderDetail(company, analyses[String(company.id)] || {});
  } catch (error) {
    console.error(error);
    renderError(error.message);
  }
}

function renderDetail(company, analysis) {
  document.title = `${company.name} 분석 | AI 제휴 후보 발굴 시스템`;

  const searchHistory = company.searchHistory || [];
  const snsHistory = company.snsHistory || [];

  document.querySelector("#detailContent").innerHTML = `
    <section class="detail-hero">
      <div class="detail-top">
        <div>
          <div class="detail-category">${escapeHtml(company.industry)} · ${escapeHtml(company.status || "성장 후보")}</div>
          <h2 class="detail-title">${escapeHtml(company.name)}</h2>
          <p class="detail-description">${escapeHtml(company.description)}</p>
        </div>
        <div class="score-big">
          <span>종합 관심도</span>
          <strong>${company.interestScore}</strong>
        </div>
      </div>

      <div class="detail-metrics">
        <div class="detail-metric">
          <span>성장률</span>
          <strong class="positive">+${company.growth}%</strong>
        </div>
        <div class="detail-metric">
          <span>검색량 증가</span>
          <strong class="positive">+${company.searchGrowth}%</strong>
        </div>
        <div class="detail-metric">
          <span>SNS 언급 증가</span>
          <strong class="positive">+${company.snsGrowth}%</strong>
        </div>
        <div class="detail-metric">
          <span>주요 고객</span>
          <strong>${escapeHtml(company.customersShort)}</strong>
        </div>
      </div>
    </section>

    <div class="detail-grid">
      <section class="detail-section">
        <h3><span>DATA</span> 온라인 관심도 추이</h3>
        <div class="chart-wrap"><canvas id="trendChart"></canvas></div>
      </section>

      <section class="detail-section">
        <h3><span>INFO</span> 업체 정보</h3>
        <div class="analysis-block">
          <div class="analysis-label">주요 고객</div>
          <p>${escapeHtml(company.customers)}</p>
        </div>
        <div class="analysis-block">
          <div class="analysis-label">주요 상품 / 서비스</div>
          <div class="tag-list" style="margin-top:7px">
            ${(company.products || []).map(p => `<span class="tag">${escapeHtml(p)}</span>`).join("")}
          </div>
        </div>
        <div class="analysis-block">
          <div class="analysis-label">최근 데이터 기준일</div>
          <p>${escapeHtml(company.updatedAt || "-")}</p>
        </div>
      </section>

      <section class="detail-section">
        <h3><span>AI</span> AI 비즈니스 분석</h3>
        ${analysisBlocks(analysis)}
      </section>

      <section class="detail-section">
        <h3><span>AI</span> AI 제휴 전략</h3>
        <div class="strategy-list">
          ${(analysis.strategies || []).map((s, i) => `
            <div class="strategy">
              <strong>${i + 1}. ${escapeHtml(s.title)}</strong>
              <p>${escapeHtml(s.description)}</p>
              <div class="strategy-meta">
                ${(s.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    </div>

    <section class="cta">
      <h3>✨ AI 제휴 전략 상세 검토</h3>
      <p>현재는 PoC 분석 결과를 표시하고 있습니다. 실제 운영 단계에서는 외부 데이터와 AI API를 연계하여 분석 결과를 자동 생성할 수 있습니다.</p>
      <button type="button" id="saveButton">제휴 후보로 저장</button>
    </section>
  `;

  drawTrendChart(searchHistory, snsHistory);
  document.querySelector("#saveButton").addEventListener("click", () => {
    const saved = JSON.parse(localStorage.getItem("savedCompanies") || "[]");
    if (!saved.includes(company.id)) saved.push(company.id);
    localStorage.setItem("savedCompanies", JSON.stringify(saved));
    document.querySelector("#saveButton").textContent = "✓ 제휴 후보로 저장됨";
  });
}

function analysisBlocks(analysis) {
  const blocks = [
    ["기업 요약", analysis.summary],
    ["성장 요인", analysis.growthReason],
    ["고객 분석", analysis.customers],
    ["시장 트렌드", analysis.market]
  ];

  return blocks
    .filter(([, text]) => text)
    .map(([label, text]) => `
      <div class="analysis-block">
        <div class="analysis-label">${escapeHtml(label)}</div>
        <p>${escapeHtml(text)}</p>
      </div>
    `).join("");
}

function drawTrendChart(searchHistory, snsHistory) {
  const canvas = document.querySelector("#trendChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const padding = { left: 36, right: 12, top: 15, bottom: 28 };

  const labels = searchHistory.map(item => item.month);
  const search = searchHistory.map(item => item.value);
  const sns = snsHistory.map(item => item.value);
  const all = [...search, ...sns];
  const min = Math.min(...all) - 10;
  const max = Math.max(...all) + 10;

  ctx.clearRect(0, 0, width, height);
  ctx.font = "10px sans-serif";

  // Grid
  ctx.strokeStyle = "#eceef5";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + ((height - padding.top - padding.bottom) * i / 4);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Y labels
  ctx.fillStyle = "#9299aa";
  for (let i = 0; i <= 4; i++) {
    const value = Math.round(max - ((max - min) * i / 4));
    const y = padding.top + ((height - padding.top - padding.bottom) * i / 4) + 3;
    ctx.fillText(String(value), 2, y);
  }

  drawLine(ctx, search, "#4f46e5", "검색 관심도", labels, width, height, padding, min, max);
  drawLine(ctx, sns, "#0f9f6e", "SNS 활동", labels, width, height, padding, min, max);

  // Legend
  ctx.fillStyle = "#4f46e5";
  ctx.fillRect(padding.left, height - 13, 9, 2);
  ctx.fillStyle = "#697386";
  ctx.fillText("검색 관심도", padding.left + 14, height - 9);

  ctx.fillStyle = "#0f9f6e";
  ctx.fillRect(padding.left + 90, height - 13, 9, 2);
  ctx.fillStyle = "#697386";
  ctx.fillText("SNS 활동", padding.left + 104, height - 9);
}

function drawLine(ctx, data, color, label, labels, width, height, padding, min, max) {
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((value, i) => ({
    x: padding.left + (chartW * i / Math.max(1, data.length - 1)),
    y: padding.top + chartH - ((value - min) / (max - min)) * chartH
  }));

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  ctx.fillStyle = color;
  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#9299aa";
    ctx.font = "9px sans-serif";
    ctx.fillText(labels[i], p.x - 10, height - 19);
    ctx.fillStyle = color;
  });
}

function renderError(message) {
  document.querySelector("#detailContent").innerHTML =
    `<div class="error">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadDetail();
