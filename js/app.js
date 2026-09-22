let companies = [];


/* =========================================
   기본 DOM 선택
========================================= */

const $ = (selector) => {
  return document.querySelector(selector);
};


/* =========================================
   업체 데이터 불러오기
========================================= */

async function loadCompanies() {

  try {

    const response =
      await fetch("./data/companies.json");


    if (!response.ok) {

      throw new Error(
        "업체 데이터를 불러오지 못했습니다."
      );

    }


    companies =
      await response.json();


    initializeFilters();

    renderDashboard();


  } catch (error) {

    console.error(error);


    const companyList =
      $("#companyList");


    if (companyList) {

      companyList.innerHTML = `
        <div class="error">

          ${escapeHtml(error.message)}

          <br>

          GitHub Pages에서 실행 중인지 확인해주세요.

        </div>
      `;

    }

  }

}


/* =========================================
   필터 초기화
========================================= */

function initializeFilters() {

  const industryFilter =
    $("#industryFilter");

  const sortFilter =
    $("#sortFilter");

  const searchInput =
    $("#searchInput");


  /*
   * 업체 데이터에서 업종 목록 생성
   */

  const industries = [
    ...new Set(
      companies
        .map(company => company.industry)
        .filter(Boolean)
    )
  ].sort();


  industryFilter.innerHTML =
    `
      <option value="ALL">
        전체
      </option>
    ` +

    industries
      .map(industry => `
        <option value="${escapeHtml(industry)}">
          ${escapeHtml(industry)}
        </option>
      `)
      .join("");


  /*
   * 이벤트 등록
   */

  industryFilter.addEventListener(
    "change",
    renderDashboard
  );


  sortFilter.addEventListener(
    "change",
    renderDashboard
  );


  searchInput.addEventListener(
    "input",
    renderDashboard
  );

}


/* =========================================
   Dashboard 렌더링
========================================= */

function renderDashboard() {

  const industry =
    $("#industryFilter").value;


  const sort =
    $("#sortFilter").value;


  const keyword =
    $("#searchInput")
      .value
      .trim()
      .toLowerCase();


  /*
   * 업체 필터링
   */

  let filtered =
    companies.filter(company => {

      const companyIndustry =
        String(
          company.industry || ""
        );


      const companyName =
        String(
          company.name || ""
        );


      const description =
        String(
          company.description || ""
        );


      const matchesIndustry =
        industry === "ALL" ||
        companyIndustry === industry;


      const matchesKeyword =
        !keyword ||

        companyName
          .toLowerCase()
          .includes(keyword) ||

        companyIndustry
          .toLowerCase()
          .includes(keyword) ||

        description
          .toLowerCase()
          .includes(keyword);


      return (
        matchesIndustry &&
        matchesKeyword
      );

    });


  /*
   * 정렬
   */

  filtered.sort(
    (a, b) => {

      /*
       * 뉴스 활동량순
       */

      if (sort === "news") {

        return (
          (b.newsCount || 0) -
          (a.newsCount || 0)
        );

      }


      /*
       * 외부 활동 지수순
       */

      if (sort === "activity") {

        return (
          (b.newsActivityScore || 0) -
          (a.newsActivityScore || 0)
        );

      }


      /*
       * 기본:
       * 종합 관심도순
       */

      return (
        (b.interestScore || 0) -
        (a.interestScore || 0)
      );

    }
  );


  /*
   * 화면 출력
   */

  renderStats();

  renderCompanies(filtered);

}


/* =========================================
   상단 통계
========================================= */

function renderStats() {

  /*
   * 전체 수집 뉴스
   */

  const totalNews =
    companies.reduce(
      (sum, company) => {

        return (
          sum +
          Number(
            company.newsCount || 0
          )
        );

      },
      0
    );


  /*
   * 평균 관심도
   */

  const avgScore =
    companies.length > 0

      ? Math.round(

          companies.reduce(
            (sum, company) => {

              return (
                sum +
                Number(
                  company.interestScore || 0
                )
              );

            },
            0
          )

          / companies.length

        )

      : 0;


  /*
   * 활동 지수 80 이상 업체
   */

  const highActivity =
    companies.filter(
      company =>

        Number(
          company.newsActivityScore || 0
        ) >= 80

    ).length;


  /*
   * 통계 화면
   */

  $("#statsGrid").innerHTML = `

    <!-- 분석 업체 -->

    <div class="stat-card">

      <span class="stat-label">
        분석 업체
      </span>

      <div class="stat-value">
        ${companies.length}
        <small>개</small>
      </div>

      <div class="stat-sub">
        외부 데이터 기반
      </div>

    </div>


    <!-- 고활동 업체 -->

    <div class="stat-card">

      <span class="stat-label">
        고활동 업체
      </span>

      <div class="stat-value">
        ${highActivity}
        <small>개</small>
      </div>

      <div class="stat-sub">
        활동 지수 80 이상
      </div>

    </div>


    <!-- 수집 뉴스 -->

    <div class="stat-card">

      <span class="stat-label">
        수집 뉴스
      </span>

      <div class="stat-value">
        ${totalNews}
        <small>건</small>
      </div>

      <div class="stat-sub">
        업체 관련 최근 뉴스
      </div>

    </div>


    <!-- 평균 관심도 -->

    <div class="stat-card">

      <span class="stat-label">
        평균 관심도
      </span>

      <div class="stat-value">
        ${avgScore}
        <small>점</small>
      </div>

      <div class="stat-sub">
        외부 활동 기반
      </div>

    </div>

  `;

}


/* =========================================
   업체 목록
========================================= */

function renderCompanies(list) {

  const container =
    $("#companyList");


  /*
   * 검색 결과 없음
   */

  if (!list.length) {

    container.innerHTML = `
      <div class="empty">
        검색 조건에 맞는 업체가 없습니다.
      </div>
    `;

    return;

  }


  /*
   * 업체 카드
   */

  container.innerHTML =

    list
      .map(
        (company, index) => {

          const newsCount =
            Number(
              company.newsCount || 0
            );


          const activityScore =
            Number(
              company.newsActivityScore || 0
            );


          const interestScore =
            Number(
              company.interestScore || 0
            );


          return `

            <article class="company-card">


              <!-- 순위 -->

              <div class="rank">

                ${String(
                  index + 1
                ).padStart(2, "0")}

              </div>


              <!-- 업체 정보 -->

              <div>

                <div class="company-name">

                  ${escapeHtml(
                    company.name || "-"
                  )}

                </div>


                <div class="company-industry">

                  ${escapeHtml(
                    company.industry || "-"
                  )}

                </div>

              </div>


              <!-- 뉴스 활동 -->

              <div class="metric">

                <span class="metric-label">
                  뉴스 활동
                </span>

                <span class="metric-value">

                  ${newsCount}건

                </span>

              </div>


              <!-- 활동 지수 -->

              <div class="metric">

                <span class="metric-label">
                  활동 지수
                </span>

                <span class="metric-value positive">

                  ${activityScore}

                </span>

              </div>


              <!-- 외부 관심도 -->

              <div class="metric">

                <span class="metric-label">
                  외부 관심도
                </span>

                <span class="metric-value">

                  ${interestScore}

                </span>

              </div>


              <!-- 관심도 -->

              <div class="score-pill">

                관심도
                ${interestScore}

              </div>


              <!-- 상세 분석 -->

              <a
                class="detail-btn"
                href="./company.html?id=${encodeURIComponent(
                  company.id
                )}"
              >

                상세 분석 →

              </a>


            </article>

          `;

        }
      )
      .join("");

}


/* =========================================
   HTML Escape
========================================= */

function escapeHtml(value) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =========================================
   시작
========================================= */

loadCompanies();