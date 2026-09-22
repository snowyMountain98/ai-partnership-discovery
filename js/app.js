let companies = [];

const $ = (selector) => document.querySelector(selector);

async function loadCompanies() {
  try {
    const response = await fetch("./data/companies.json");
    if (!response.ok) throw new Error("업체 데이터를 불러오지 못했습니다.");
    companies = await response.json();
    initializeFilters();
    renderDashboard();
  } catch (error) {
    console.error(error);
    $("#companyList").innerHTML = `<div class="error">${error.message}<br>GitHub Pages에서 실행 중인지 확인해주세요.</div>`;
  }
}

function initializeFilters() {
  const industries = [...new Set(companies.map(c => c.industry))].sort();
  $("#industryFilter").innerHTML =
    '<option value="ALL">전체</option>' +
    industries.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join("");

  $("#industryFilter").addEventListener("change", renderDashboard);
  $("#sortFilter").addEventListener("change", renderDashboard);
  $("#searchInput").addEventListener("input", renderDashboard);
}

function renderDashboard() {
  const industry = $("#industryFilter").value;
  const sort = $("#sortFilter").value;
  const keyword = $("#searchInput").value.trim().toLowerCase();

  let filtered = companies.filter(company => {
    const matchesIndustry = industry === "ALL" || company.industry === industry;
    const matchesKeyword =
      !keyword ||
      company.name.toLowerCase().includes(keyword) ||
      company.description.toLowerCase().includes(keyword) ||
      company.industry.toLowerCase().includes(keyword);
    return matchesIndustry && matchesKeyword;
  });

  filtered.sort((a, b) => {
    if (sort === "growth") return b.growth - a.growth;
    if (sort === "search") return b.searchGrowth - a.searchGrowth;
    if (sort === "sns") return b.snsGrowth - a.snsGrowth;
    return b.interestScore - a.interestScore;
  });

  renderStats();
  renderCompanies(filtered);
}

function renderStats() {
  const avgGrowth = companies.length
    ? Math.round(companies.reduce((sum, c) => sum + c.growth, 0) / companies.length)
    : 0;
  const highGrowth = companies.filter(c => c.growth >= 30).length;
  const avgScore = companies.length
    ? Math.round(companies.reduce((sum, c) => sum + c.interestScore, 0) / companies.length)
    : 0;

  $("#statsGrid").innerHTML = `
    <div class="stat-card">
      <span class="stat-label">분석 업체</span>
      <div class="stat-value">${companies.length}<small>개</small></div>
      <div class="stat-sub">외부 데이터 기반</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">고성장 후보</span>
      <div class="stat-value">${highGrowth}<small>개</small></div>
      <div class="stat-sub">성장률 30% 이상</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">평균 성장률</span>
      <div class="stat-value">+${avgGrowth}<small>%</small></div>
      <div class="stat-sub">최근 3개월</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">평균 관심도</span>
      <div class="stat-value">${avgScore}<small>점</small></div>
      <div class="stat-sub">검색·SNS 종합</div>
    </div>
  `;
}

function renderCompanies(list) {
  const container = $("#companyList");

  if (!list.length) {
    container.innerHTML = `<div class="empty">검색 조건에 맞는 업체가 없습니다.</div>`;
    return;
  }

  container.innerHTML = list.map((company, index) => `
    <article class="company-card">
      <div class="rank">${String(index + 1).padStart(2, "0")}</div>
      <div>
        <div class="company-name">${escapeHtml(company.name)}</div>
        <div class="company-industry">${escapeHtml(company.industry)}</div>
      </div>
      <div class="metric">
        <span class="metric-label">성장률</span>
        <span class="metric-value positive">+${company.growth}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">검색 증가</span>
        <span class="metric-value positive">+${company.searchGrowth}%</span>
      </div>
      <div class="metric">
        <span class="metric-label">SNS 증가</span>
        <span class="metric-value positive">+${company.snsGrowth}%</span>
      </div>
      <div class="score-pill">관심도 ${company.interestScore}</div>
      <a class="detail-btn" href="./company.html?id=${company.id}">상세 분석 →</a>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadCompanies();
