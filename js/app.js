let companies = [];
const $ = selector => document.querySelector(selector);

async function loadCompanies() {
  try {
    const response = await fetch("./data/companies.json");
    if (!response.ok) throw new Error("가맹점 후보 데이터를 불러오지 못했습니다.");
    companies = await response.json();
    initializeFilters();
    renderDashboard();
  } catch (error) {
    console.error(error);
    const companyList = $("#companyList");
    if (companyList) {
      companyList.innerHTML = `<div class="error">${escapeHtml(error.message)}<br>GitHub Pages에서 실행 중인지 확인해주세요.</div>`;
    }
  }
}

function initializeFilters() {
  const industryFilter = $("#industryFilter");
  const sortFilter = $("#sortFilter");
  const searchInput = $("#searchInput");

  const industries = [...new Set(companies.map(c => c.industry).filter(Boolean))].sort();
  industryFilter.innerHTML = `<option value="ALL">전체</option>` + industries.map(industry =>
    `<option value="${escapeHtml(industry)}">${escapeHtml(industry)}</option>`
  ).join("");

  industryFilter.addEventListener("change", renderDashboard);
  sortFilter.addEventListener("change", renderDashboard);
  searchInput.addEventListener("input", renderDashboard);
}

function renderDashboard() {
  const industry = $("#industryFilter").value;
  const sort = $("#sortFilter").value;
  const keyword = $("#searchInput").value.trim().toLowerCase();

  let filtered = companies.filter(company => {
    const searchable = [
      company.name,
      company.industry,
      company.description,
      ...(company.fitServices || []),
      ...(company.discoverySignals || [])
    ].join(" ").toLowerCase();

    return (industry === "ALL" || company.industry === industry) &&
      (!keyword || searchable.includes(keyword));
  });

  filtered.sort((a, b) => {
    if (sort === "news") return (b.newsCount || 0) - (a.newsCount || 0);
    if (sort === "activity") return (b.newsActivityScore || 0) - (a.newsActivityScore || 0);
    return (b.merchantFitScore || b.partnershipScore || 0) - (a.merchantFitScore || a.partnershipScore || 0);
  });

  renderStats();
  renderCompanies(filtered);
}

function renderStats() {
  const totalNews = companies.reduce((sum, company) => sum + Number(company.newsCount || 0), 0);
  const avgFit = companies.length
    ? Math.round(companies.reduce((sum, company) => sum + Number(company.merchantFitScore || 0), 0) / companies.length)
    : 0;
  const highFit = companies.filter(company => Number(company.merchantFitScore || 0) >= 70).length;
  const paymentCandidates = companies.filter(company => company.paymentNeed).length;

  $("#statsGrid").innerHTML = `
    <div class="stat-card">
      <span class="stat-label">가맹점 후보</span>
      <div class="stat-value">${companies.length}<small>개</small></div>
      <div class="stat-sub">외부 데이터 + AI 검증</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">높은 제휴 적합도</span>
      <div class="stat-value">${highFit}<small>개</small></div>
      <div class="stat-sub">가맹점 적합도 70 이상</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">결제 수요 후보</span>
      <div class="stat-value">${paymentCandidates}<small>개</small></div>
      <div class="stat-sub">상품·서비스 거래 신호 확인</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">수집 뉴스</span>
      <div class="stat-value">${totalNews}<small>건</small></div>
      <div class="stat-sub">최근 14일 외부 뉴스</div>
    </div>
  `;
}

function renderCompanies(list) {
  const container = $("#companyList");
  if (!list.length) {
    container.innerHTML = `<div class="empty">조건에 맞는 가맹점 후보가 없습니다.</div>`;
    return;
  }

  container.innerHTML = list.map((company, index) => {
    const score = Number(company.merchantFitScore || company.partnershipScore || 0);
    const services = (company.fitServices || []).slice(0, 3);
    const signals = (company.discoverySignals || []).slice(0, 2);

    return `
      <article class="company-card merchant-card">
        <div class="rank">${String(index + 1).padStart(2, "0")}</div>
        <div class="company-main">
          <div class="company-name">${escapeHtml(company.name || "-")}</div>
          <div class="company-industry">${escapeHtml(company.industry || "-")}</div>
          <div class="tag-list compact-tags">
            ${services.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
        <div class="metric">
          <span class="metric-label">뉴스</span>
          <span class="metric-value">${company.newsCount || 0}건</span>
        </div>
        <div class="metric">
          <span class="metric-label">결제 수요</span>
          <span class="metric-value ${company.paymentNeed ? "positive" : ""}">${company.paymentNeed ? "확인" : "낮음"}</span>
        </div>
        <div class="fit-score">
          <span>가맹점 적합도</span>
          <strong>${score}</strong>
        </div>
        <a class="detail-btn" href="./company.html?id=${encodeURIComponent(company.id)}">상세 분석 →</a>
        <div class="company-reason">
          ${signals.map(signal => `<span>✓ ${escapeHtml(signal)}</span>`).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadCompanies();
