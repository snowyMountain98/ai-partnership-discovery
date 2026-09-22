const params = new URLSearchParams(location.search);
const companyId = params.get("id");
let companies = [];
let analyses = {};

async function loadCompanyData() {
  try {
    const [companyResponse, analysisResponse] = await Promise.all([
      fetch("./data/companies.json"),
      fetch("./data/analyses.json")
    ]);
    if (!companyResponse.ok) throw new Error("companies.json을 불러오지 못했습니다.");
    if (!analysisResponse.ok) throw new Error("analyses.json을 불러오지 못했습니다.");

    companies = await companyResponse.json();
    analyses = await analysisResponse.json();
    const company = companies.find(item => String(item.id) === String(companyId));

    if (!company) return renderError("가맹점 후보 정보를 찾을 수 없습니다.");

    renderCompany(company);
    const analysis = analyses[company.id];
    if (analysis) renderAIAnalysis(analysis);
    else renderNoAnalysis();
  } catch (error) {
    console.error(error);
    renderError("데이터를 불러오는 중 오류가 발생했습니다.");
  }
}

function renderCompany(company) {
  document.title = `${company.name} | KB스타플랫폼 가맹점 후보`;
  const score = Number(company.merchantFitScore || company.partnershipScore || 0);
  const status = company.paymentSystemStatus === "unknown" ? "공개자료상 미확인" : company.paymentSystemStatus === "existing" ? "기존 시스템 확인" : "결제사업자 성격";
  const validationStatus = company.aiValidationStatus === "verified" ? "AI 검증 완료" : "1차 발굴 후보";
  const services = company.fitServices || [];
  const evidence = company.aiMerchantEvidence || company.discoverySignals || [];

  document.getElementById("detailContent").innerHTML = `
    <section class="company-header">
      <div class="company-header-top">
        <div>
          <span class="company-industry">${escapeHtml(company.industry || "-")}</span>
          <h2 class="company-title">${escapeHtml(company.name)}</h2>
          <p class="company-description">${escapeHtml(company.description || "실제 상품·서비스 결제가 발생할 가능성이 있는 가맹점 후보")}</p>
        </div>
        <div class="interest-score fit-score-large">
          <span>가맹점 적합도</span>
          <strong>${score}</strong>
          <small class="verification-status">${validationStatus}</small>
        </div>
      </div>

      <div class="company-metrics">
        <div class="metric"><span>거래 신호</span><strong>${company.paymentNeed ? "확인" : "추가 확인"}</strong></div>
        <div class="metric"><span>자체 결제시스템</span><strong>${escapeHtml(status)}</strong></div>
        <div class="metric"><span>최근 뉴스</span><strong>${company.newsCount || 0}건</strong></div>
      </div>

      <div class="detail-fit-box">
        <div>
          <span class="detail-fit-label">추천 KB스타플랫폼 서비스</span>
          <div class="tag-list">
            ${services.map(service => `<span class="tag tag-primary">${escapeHtml(service)}</span>`).join("") || `<span class="muted">추가 확인 필요</span>`}
          </div>
        </div>
        <div>
          <span class="detail-fit-label">가맹점 후보 근거</span>
          <ul class="evidence-list">
            ${evidence.map(item => `<li>${escapeHtml(item)}</li>`).join("") || `<li>공개 근거 추가 확인 필요</li>`}
          </ul>
        </div>
      </div>
    </section>

    <section class="detail-section">
      <div class="section-label">DISCOVERY EVIDENCE</div>
      <h2>왜 이 기업이 후보인가?</h2>
      <div class="analysis-summary">${escapeHtml(company.discoveryReason || "외부 뉴스에서 상품·서비스 거래 관련 신호가 확인되었습니다.")}</div>
      <div class="source-note">※ 자체 결제시스템 보유 여부는 공개 뉴스에서 확인된 범위만 반영합니다. 미확인은 미보유를 의미하지 않습니다.</div>
    </section>

    <section class="detail-section">
      <div class="section-label">RECENT NEWS</div>
      <h2>최근 외부 동향</h2>
      <div id="newsList" class="news-list"></div>
    </section>

    <div id="aiAnalysis"></div>
  `;

  renderNews(company);
}

function renderNews(company) {
  const newsList = document.getElementById("newsList");
  if (!company.latestNews?.length) {
    newsList.innerHTML = `<div class="empty-analysis">최근 뉴스 데이터가 없습니다.</div>`;
    return;
  }

  newsList.innerHTML = company.latestNews.slice(0, 5).map(news => `
    <div class="news-item">
      <div class="news-title">${escapeHtml(news.title || "제목 없음")}</div>
      ${news.link ? `<a href="${escapeAttribute(news.link)}" target="_blank" rel="noopener noreferrer">뉴스 보기 →</a>` : ""}
    </div>
  `).join("");
}

function renderAIAnalysis(analysis) {
  const container = document.getElementById("aiAnalysis");
  const candidate = analysis.isMerchantCandidate !== false;
  const evidence = analysis.merchantEvidence || [];
  const paymentStatus = analysis.paymentSystemStatus || "unknown";

  container.innerHTML = `
    <section class="ai-section">
      <div class="section-label">AI MERCHANT VALIDATION</div>
      <h2>AI 가맹점 적합성 검증</h2>
      <div class="validation-banner ${candidate ? "validation-ok" : "validation-no"}">
        <strong>${candidate ? "가맹점 제휴 후보" : "가맹점 제휴 후보에서 제외"}</strong>
        <span>결제시스템 상태: ${escapeHtml(paymentStatus === "existing" ? "기존 시스템 확인" : paymentStatus === "provider" ? "결제사업자" : "공개자료상 미확인")}</span>
      </div>
      ${evidence.length ? `<ul class="analysis-list">${evidence.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${analysis.paymentSystemEvidence ? `<div class="source-note">결제시스템 관련 근거: ${escapeHtml(analysis.paymentSystemEvidence)}</div>` : ""}
    </section>

    <section class="ai-section">
      <div class="section-label">AI BUSINESS ANALYSIS</div>
      <h2>사업 동향</h2>
      <div class="analysis-summary">${escapeHtml(analysis.summary || "분석 내용이 없습니다.")}</div>
      <h3>주요 사업 동향</h3>
      <ul class="analysis-list">${(analysis.businessTrend || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>

    <section class="ai-section">
      <div class="section-label">PARTNERSHIP OPPORTUNITY</div>
      <h2>제휴 기회</h2>
      <div class="opportunity-list">
        ${(analysis.partnershipOpportunities || []).map(item => `
          <div class="opportunity-card">
            <h3>${escapeHtml(item.title || "")}</h3>
            <p>${escapeHtml(item.description || "")}</p>
            <div class="expected-effect"><strong>기대 효과</strong><span>${escapeHtml(item.expectedEffect || "")}</span></div>
          </div>
        `).join("")}
      </div>
    </section>

    <section class="ai-section">
      <div class="section-label">AI PARTNERSHIP STRATEGY</div>
      <h2>AI 제휴 전략</h2>
      <ol class="strategy-list">${(analysis.recommendedStrategy || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
    </section>

    <section class="ai-section">
      <div class="section-label">RISK FACTORS</div>
      <h2>검토 필요사항</h2>
      <ul class="risk-list">${(analysis.riskFactors || []).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </section>

    <div class="ai-generated">AI 분석 생성일: ${formatDate(analysis.generatedAt)}</div>
  `;
}

function renderNoAnalysis() {
  document.getElementById("aiAnalysis").innerHTML = `
    <section class="ai-section"><div class="section-label">AI VALIDATION</div><h2>AI 가맹점 검증</h2><div class="empty-analysis">아직 AI 검증 결과가 생성되지 않았습니다.</div></section>
  `;
}

function renderError(message) {
  document.getElementById("detailContent").innerHTML = `<div class="empty-analysis">${escapeHtml(message)}</div>`;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("ko-KR");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

loadCompanyData();
