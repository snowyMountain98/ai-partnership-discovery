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

    if (!companyResponse.ok) {
      throw new Error("companies.json을 불러오지 못했습니다.");
    }

    if (!analysisResponse.ok) {
      throw new Error("analyses.json을 불러오지 못했습니다.");
    }

    companies = await companyResponse.json();
    analyses = await analysisResponse.json();

    const company = companies.find(
      item => String(item.id) === String(companyId)
    );

    if (!company) {
      renderError("업체 정보를 찾을 수 없습니다.");
      return;
    }

    renderCompany(company);

    const analysis = analyses[company.id];

    if (analysis) {
      renderAIAnalysis(analysis);
    } else {
      renderNoAnalysis();
    }

  } catch (error) {
    console.error(error);
    renderError("데이터를 불러오는 중 오류가 발생했습니다.");
  }
}


/* --------------------------------
   업체 기본 정보
-------------------------------- */

function renderCompany(company) {
  document.title = `${company.name} | AI 제휴 후보 발굴`;

  const detailContent = document.getElementById("detailContent");

  detailContent.innerHTML = `
    <section class="company-header">

      <div class="company-header-top">
        <div>
          <span class="company-industry">
            ${escapeHtml(company.industry || "-")}
          </span>

          <h2 class="company-title">
            ${escapeHtml(company.name)}
          </h2>
        </div>

        <div class="interest-score">
          <span>외부 관심도</span>
          <strong>${company.interestScore ?? 0}</strong>
        </div>
      </div>

      <div class="company-metrics">

        <div class="metric">
          <span>뉴스 수</span>
          <strong>${company.newsCount ?? 0}</strong>
        </div>

        <div class="metric">
          <span>뉴스 활동 지수</span>
          <strong>${company.newsActivityScore ?? 0}</strong>
        </div>

        <div class="metric">
          <span>외부 관심도</span>
          <strong>${company.interestScore ?? 0}</strong>
        </div>

      </div>

    </section>


    <section class="detail-section">

      <div class="section-label">
        RECENT NEWS
      </div>

      <h2>최근 외부 동향</h2>

      <div id="newsList" class="news-list"></div>

    </section>


    <div id="aiAnalysis"></div>
  `;

  renderNews(company);
}


/* --------------------------------
   최근 뉴스
-------------------------------- */

function renderNews(company) {
  const newsList = document.getElementById("newsList");

  if (!company.latestNews || company.latestNews.length === 0) {
    newsList.innerHTML = `
      <div class="empty-analysis">
        최근 뉴스 데이터가 없습니다.
      </div>
    `;

    return;
  }

  newsList.innerHTML = company.latestNews
    .slice(0, 5)
    .map(news => {

      const title = escapeHtml(news.title || "제목 없음");

      const link = news.link
        ? `
          <a
            href="${escapeAttribute(news.link)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            뉴스 보기 →
          </a>
        `
        : "";

      return `
        <div class="news-item">

          <div class="news-title">
            ${title}
          </div>

          ${link}

        </div>
      `;
    })
    .join("");
}


/* --------------------------------
   AI 분석
-------------------------------- */

function renderAIAnalysis(analysis) {
  const container = document.getElementById("aiAnalysis");

  container.innerHTML = `

    <!-- AI 사업 분석 -->

    <section class="ai-section">

      <div class="section-label">
        AI BUSINESS ANALYSIS
      </div>

      <h2>AI 사업 분석</h2>

      <div class="analysis-summary">
        ${escapeHtml(analysis.summary || "분석 내용이 없습니다.")}
      </div>

      <h3>주요 사업 동향</h3>

      <ul class="analysis-list">

        ${(analysis.businessTrend || [])
          .map(item => `
            <li>
              ${escapeHtml(item)}
            </li>
          `)
          .join("")}

      </ul>

    </section>


    <!-- 제휴 기회 -->

    <section class="ai-section">

      <div class="section-label">
        PARTNERSHIP OPPORTUNITY
      </div>

      <h2>제휴 기회</h2>

      <div class="opportunity-list">

        ${(analysis.partnershipOpportunities || [])
          .map(item => `
            <div class="opportunity-card">

              <h3>
                ${escapeHtml(item.title || "")}
              </h3>

              <p>
                ${escapeHtml(item.description || "")}
              </p>

              <div class="expected-effect">

                <strong>기대 효과</strong>

                <span>
                  ${escapeHtml(item.expectedEffect || "")}
                </span>

              </div>

            </div>
          `)
          .join("")}

      </div>

    </section>


    <!-- AI 제휴 전략 -->

    <section class="ai-section">

      <div class="section-label">
        AI PARTNERSHIP STRATEGY
      </div>

      <h2>AI 제휴 전략</h2>

      <ol class="strategy-list">

        ${(analysis.recommendedStrategy || [])
          .map(item => `
            <li>
              ${escapeHtml(item)}
            </li>
          `)
          .join("")}

      </ol>

    </section>


    <!-- 고려사항 -->

    <section class="ai-section">

      <div class="section-label">
        RISK FACTORS
      </div>

      <h2>고려사항</h2>

      <ul class="risk-list">

        ${(analysis.riskFactors || [])
          .map(item => `
            <li>
              ${escapeHtml(item)}
            </li>
          `)
          .join("")}

      </ul>

    </section>


    <div class="ai-generated">
      AI 분석 생성일:
      ${formatDate(analysis.generatedAt)}
    </div>
  `;
}


/* --------------------------------
   AI 분석이 없는 경우
-------------------------------- */

function renderNoAnalysis() {
  document.getElementById("aiAnalysis").innerHTML = `

    <section class="ai-section">

      <div class="section-label">
        AI BUSINESS ANALYSIS
      </div>

      <h2>AI 사업 분석</h2>

      <div class="empty-analysis">
        아직 AI 분석 결과가 생성되지 않았습니다.
      </div>

    </section>

  `;
}


/* --------------------------------
   오류
-------------------------------- */

function renderError(message) {
  const detailContent = document.getElementById("detailContent");

  detailContent.innerHTML = `
    <div class="empty-analysis">
      ${escapeHtml(message)}
    </div>
  `;
}


/* --------------------------------
   날짜
-------------------------------- */

function formatDate(dateString) {
  if (!dateString) {
    return "-";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("ko-KR");
}


/* --------------------------------
   HTML 보안 처리
-------------------------------- */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


loadCompanyData();