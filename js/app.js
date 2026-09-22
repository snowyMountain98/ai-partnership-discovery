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
  const highFit = companies.filter(company => Number(company.merchantFitScore || 0) >= 70).length;
  const paymentCandidates = companies.filter(company => company.paymentNeed).length;
  const verified = companies.filter(company => company.aiValidationStatus === "verified").length;
  const social = companies.filter(company => company.socialSignal || (company.sourceTypes || []).some(type => ["social", "social-web", "social-youtube"].includes(type))).length;
  const commerce = companies.filter(company => company.commerceSignal || (company.sourceTypes || []).some(type => ["commerce", "commerce-local", "commerce-shop"].includes(type))).length;

  $("#statsGrid").innerHTML = `
    <div class="stat-card">
      <span class="stat-label">가맹점 후보</span>
      <div class="stat-value">${companies.length}<small>개</small></div>
      <div class="stat-sub">최대 150개까지 발굴</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">다채널 발굴</span>
      <div class="stat-value">${social}<small>개</small></div>
      <div class="stat-sub">SNS·블로그·YouTube 신호</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">상거래 데이터</span>
      <div class="stat-value">${commerce}<small>개</small></div>
      <div class="stat-sub">Naver 지역·쇼핑 신호</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">AI 검증 완료</span>
      <div class="stat-value">${verified}<small>개</small></div>
      <div class="stat-sub">상위 후보 30개 우선 검증</div>
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
    const sources = (company.sourceTypes || []).slice(0, 3);

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
          <small class="verification-status">${company.aiValidationStatus === "verified" ? "AI 검증 완료" : "1차 발굴"}</small>
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
