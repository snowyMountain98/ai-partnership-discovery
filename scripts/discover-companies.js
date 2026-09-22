const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

const OUTPUT_FILE = path.join(__dirname, "../data/companies.json");

const RSS_BASE_URL =
  "https://news.google.com/rss/search";

const NEWS_PERIOD = "when:7d";

// 너무 많은 기사를 가져오지 않도록 제한
const MAX_NEWS_PER_QUERY = 30;

// 최종적으로 저장할 기업 수
const MAX_COMPANIES = 50;

// 최소 몇 개의 신호가 있어야 후보 기업으로 인정할지
const MIN_MENTIONS = 2;


/*
 * =========================================================
 * KB스타플랫폼 제휴 후보 발굴 검색어
 * =========================================================
 *
 * 단순히 "핀테크 기업"을 찾는 것이 아니라
 *
 * 1. 온라인 판매
 * 2. 자체 앱/플랫폼
 * 3. 간편결제
 * 4. 구독/정기결제
 * 5. B2B
 * 6. 예약/교육/여행/헬스케어 등 플랫폼
 * 7. 기부/후원/헌금
 *
 * 등 "결제가 발생할 가능성이 높은 사업"을 찾는다.
 */

const discoveryQueries = [
  // -------------------------------------------------------
  // 온라인 커머스
  // -------------------------------------------------------
  "온라인 쇼핑몰 신규 서비스 출시",
  "온라인몰 사업 확장",
  "온라인 커머스 플랫폼 출시",
  "모바일 커머스 서비스 출시",
  "자체 쇼핑 앱 출시",
  "온라인 판매 서비스 출시",

  // -------------------------------------------------------
  // 플랫폼 / 앱
  // -------------------------------------------------------
  "플랫폼 신규 서비스 출시",
  "모바일 플랫폼 신규 서비스",
  "자체 앱 서비스 출시",
  "앱 기반 서비스 출시",
  "플랫폼 사업 확장",

  // -------------------------------------------------------
  // 구독 / 정기결제
  // -------------------------------------------------------
  "구독 서비스 출시",
  "정기결제 서비스 출시",
  "월 구독 서비스 출시",
  "subscription 서비스 출시",
  "SaaS 구독 서비스 출시",
  "구독형 서비스 사업 확대",

  // -------------------------------------------------------
  // B2B
  // -------------------------------------------------------
  "B2B 플랫폼 출시",
  "B2B 서비스 출시",
  "기업용 플랫폼 출시",
  "기업 대상 플랫폼 출시",
  "B2B SaaS 출시",
  "기업용 SaaS 출시",
  "법인 대상 서비스 출시",

  // -------------------------------------------------------
  // 예약 / 교육 / 여행 / 헬스케어 / 레저
  // -------------------------------------------------------
  "예약 플랫폼 서비스 출시",
  "교육 플랫폼 서비스 출시",
  "온라인 교육 서비스 출시",
  "헬스케어 플랫폼 출시",
  "여행 플랫폼 서비스 출시",
  "레저 플랫폼 서비스 출시",
  "모빌리티 플랫폼 서비스 출시",

  // -------------------------------------------------------
  // 결제
  // -------------------------------------------------------
  "간편결제 도입 기업",
  "모바일 결제 도입",
  "온라인 결제 시스템 도입",
  "자체 결제 서비스 출시",
  "앱 결제 서비스 출시",

  // -------------------------------------------------------
  // 기부 / 후원 / 종교
  // -------------------------------------------------------
  "온라인 기부 플랫폼",
  "디지털 기부 서비스",
  "온라인 후원 서비스",
  "비영리단체 온라인 후원",
  "디지털 헌금 서비스"
];


/*
 * =========================================================
 * 제외할 일반 단어
 * =========================================================
 */

const invalidCompanyNames = new Set([
  "온라인",
  "서비스",
  "플랫폼",
  "기업",
  "업체",
  "시장",
  "사업",
  "신규",
  "출시",
  "확대",
  "도입",
  "결제",
  "간편결제",
  "정기결제",
  "구독",
  "커머스",
  "쇼핑몰",
  "스타트업",
  "금융",
  "핀테크",
  "SaaS",
  "B2B",
  "모바일",
  "앱",
  "고객",
  "소비자",
  "서비스업",
  "플랫폼업체",
  "기업들",
  "업계",
  "시장",
  "정부",
  "은행",
  "카드",
  "증권",
  "보험"
]);


/*
 * =========================================================
 * 산업 분류
 * =========================================================
 */

function inferIndustry(text) {
  const value = text.toLowerCase();

  if (
    value.includes("쇼핑") ||
    value.includes("커머스") ||
    value.includes("온라인몰") ||
    value.includes("판매")
  ) {
    return "커머스";
  }

  if (
    value.includes("구독") ||
    value.includes("subscription") ||
    value.includes("saas")
  ) {
    return "구독/SaaS";
  }

  if (
    value.includes("b2b") ||
    value.includes("법인") ||
    value.includes("기업용")
  ) {
    return "B2B";
  }

  if (
    value.includes("교육") ||
    value.includes("학습")
  ) {
    return "교육";
  }

  if (
    value.includes("여행") ||
    value.includes("호텔") ||
    value.includes("관광")
  ) {
    return "여행/관광";
  }

  if (
    value.includes("헬스") ||
    value.includes("의료") ||
    value.includes("건강")
  ) {
    return "헬스케어";
  }

  if (
    value.includes("예약") ||
    value.includes("레저")
  ) {
    return "예약/레저";
  }

  if (
    value.includes("기부") ||
    value.includes("후원") ||
    value.includes("헌금") ||
    value.includes("봉헌") ||
    value.includes("보시")
  ) {
    return "기부/비영리";
  }

  if (
    value.includes("모빌리티") ||
    value.includes("택시") ||
    value.includes("교통")
  ) {
    return "모빌리티";
  }

  return "플랫폼/서비스";
}


/*
 * =========================================================
 * 제휴 서비스 적합성 분석
 * =========================================================
 */

function analyzePartnershipFit(company) {
  const text = [
    company.name,
    company.industry,
    ...company.queries,
    ...company.news.map((news) => news.title),
    ...company.news.map((news) => news.description || "")
  ]
    .join(" ")
    .toLowerCase();

  const signals = [];

  let score = 0;

  let paymentNeed = false;
  let onlineService = false;
  let mobileApp = false;
  let subscription = false;
  let b2b = false;
  let commerce = false;
  let donation = false;

  /*
   * 온라인 서비스
   */
  if (
    text.includes("온라인") ||
    text.includes("플랫폼") ||
    text.includes("앱") ||
    text.includes("모바일") ||
    text.includes("웹")
  ) {
    onlineService = true;
    score += 15;

    signals.push("온라인/플랫폼 기반 서비스");
  }

  /*
   * 결제 수요
   */
  if (
    text.includes("결제") ||
    text.includes("판매") ||
    text.includes("쇼핑") ||
    text.includes("커머스") ||
    text.includes("예약") ||
    text.includes("주문") ||
    text.includes("구매")
  ) {
    paymentNeed = true;
    score += 25;

    signals.push("상품·서비스 판매에 따른 결제 수요");
  }

  /*
   * 자체 앱
   */
  if (
    text.includes("앱 출시") ||
    text.includes("모바일 앱") ||
    text.includes("자체 앱") ||
    text.includes("애플리케이션")
  ) {
    mobileApp = true;
    score += 10;

    signals.push("자체 모바일 앱 서비스");
  }

  /*
   * 구독 / 정기결제
   */
  if (
    text.includes("구독") ||
    text.includes("정기결제") ||
    text.includes("월 구독") ||
    text.includes("subscription") ||
    text.includes("saas")
  ) {
    subscription = true;
    paymentNeed = true;

    score += 20;

    signals.push("구독·정기결제 가능성");
  }

  /*
   * B2B
   */
  if (
    text.includes("b2b") ||
    text.includes("법인") ||
    text.includes("기업용") ||
    text.includes("기업 대상")
  ) {
    b2b = true;
    paymentNeed = true;

    score += 15;

    signals.push("B2B/법인 결제 수요 가능성");
  }

  /*
   * 커머스
   */
  if (
    text.includes("커머스") ||
    text.includes("쇼핑몰") ||
    text.includes("온라인몰") ||
    text.includes("온라인 쇼핑") ||
    text.includes("판매")
  ) {
    commerce = true;
    paymentNeed = true;

    score += 10;

    signals.push("온라인 커머스 사업");
  }

  /*
   * 기부 / 후원
   */
  if (
    text.includes("기부") ||
    text.includes("후원") ||
    text.includes("헌금") ||
    text.includes("봉헌") ||
    text.includes("보시")
  ) {
    donation = true;

    score += 20;

    signals.push("기부·후원·헌금 관련 서비스");
  }

  /*
   * 최근 사업 확장
   */
  if (
    text.includes("출시") ||
    text.includes("신규") ||
    text.includes("확장") ||
    text.includes("확대") ||
    text.includes("사업 확대") ||
    text.includes("신사업")
  ) {
    score += 5;

    signals.push("최근 신규 서비스/사업 확대");
  }

  /*
   * 최대 100점
   */
  score = Math.min(score, 100);

  /*
   * 서비스 추천
   */

  const fitServices = [];

  if (paymentNeed || commerce || onlineService) {
    fitServices.push("브랜드Pay");
  }

  if (subscription) {
    fitServices.push("정기결제");
  }

  if (b2b) {
    fitServices.push("법인결제(B2B)");
  }

  if (paymentNeed) {
    fitServices.push("현금영수증");
    fitServices.push("결제·정산 관리");
  }

  if (donation) {
    fitServices.push("KB마음더하기");
  }

  /*
   * 중복 제거
   */
  const uniqueServices = [...new Set(fitServices)];

  /*
   * 제휴 이유 생성
   */

  let discoveryReason = "";

  if (uniqueServices.length > 0) {
    discoveryReason =
      `${company.name}은(는) ${signals.slice(0, 3).join(", ")} 등의 신호가 확인되어 ` +
      `KB스타플랫폼의 ${uniqueServices.slice(0, 3).join(", ")}와의 연계 가능성을 검토할 후보로 분류했습니다.`;
  } else {
    discoveryReason =
      `${company.name}은(는) 최근 온라인 서비스 또는 사업 확장 관련 외부 활동이 확인된 기업입니다.`;
  }

  return {
    partnershipScore: score,
    paymentNeed,
    onlineService,
    mobileApp,
    subscription,
    b2b,
    commerce,
    donation,
    fitServices: uniqueServices,
    discoverySignals: signals,
    discoveryReason
  };
}


/*
 * =========================================================
 * Google News RSS 조회
 * =========================================================
 */

async function fetchNews(query) {
  const url =
    `${RSS_BASE_URL}?q=${encodeURIComponent(
      `${query} ${NEWS_PERIOD}`
    )}&hl=ko&gl=KR&ceid=KR:ko`;

  console.log(`뉴스 검색: ${query}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Google News 요청 실패: ${response.status}`
    );
  }

  const xml = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false
  });

  const parsed = parser.parse(xml);

  const items =
    parsed?.rss?.channel?.item || [];

  const normalizedItems = Array.isArray(items)
    ? items
    : [items];

  return normalizedItems
    .slice(0, MAX_NEWS_PER_QUERY)
    .map((item) => ({
      title: cleanText(item.title),
      link: item.link || "",
      pubDate: item.pubDate || "",
      description: cleanText(item.description || "")
    }))
    .filter((item) => item.title);
}


/*
 * =========================================================
 * 텍스트 정리
 * =========================================================
 */

function cleanText(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}


/*
 * =========================================================
 * 기업명 후보 추출
 * =========================================================
 *
 * 뉴스 제목에서 기업명을 찾는 휴리스틱.
 *
 * Google News 제목은 보통
 *
 * "네이버, 새로운 구독 서비스 출시"
 * "무신사, 모바일 결제 서비스 확대"
 *
 * 같은 형태이기 때문에 앞쪽 명사를 우선 추출한다.
 *
 * 완벽한 기업명 인식은 아니므로
 * 후속 AI 분석 단계에서 추가 검증한다.
 */

function extractCompanyCandidates(title) {
  const candidates = [];

  /*
   * 1. 제목 앞쪽에서
   *    "기업명, ..."
   */
  const commaMatch = title.match(
    /^([가-힣A-Za-z0-9][가-힣A-Za-z0-9&.\- ]{1,25}?)[,，:：]/
  );

  if (commaMatch) {
    candidates.push(commaMatch[1].trim());
  }

  /*
   * 2. "기업명은/는/이/가" 형태
   */
  const subjectMatch = title.match(
    /^([가-힣A-Za-z0-9][가-힣A-Za-z0-9&.\- ]{1,20}?)(?:은|는|이|가)\s/
  );

  if (subjectMatch) {
    candidates.push(subjectMatch[1].trim());
  }

  /*
   * 3. "기업명,..." 외에도
   *    괄호 안 영문명이 있는 경우
   */
  const englishMatch = title.match(
    /\(([A-Za-z][A-Za-z0-9&.\- ]{1,30})\)/
  );

  if (englishMatch) {
    candidates.push(englishMatch[1].trim());
  }

  /*
   * 4. 주식회사 XXX
   */
  const corporationMatch = title.match(
    /(?:주식회사|㈜)\s*([가-힣A-Za-z0-9&.\-]{2,30})/
  );

  if (corporationMatch) {
    candidates.push(corporationMatch[1].trim());
  }

  return candidates
    .map((name) =>
      name
        .replace(/["'“”‘’]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((name) => isValidCompanyName(name));
}


/*
 * =========================================================
 * 기업명 유효성 검사
 * =========================================================
 */

function isValidCompanyName(name) {
  if (!name) {
    return false;
  }

  if (name.length < 2 || name.length > 30) {
    return false;
  }

  if (invalidCompanyNames.has(name)) {
    return false;
  }

  /*
   * 너무 일반적인 문구 제외
   */
  const invalidPatterns = [
    /^(온라인|모바일|디지털|신규|기업|서비스|플랫폼)/,
    /(출시|확대|도입|사업|시장|업계|관련|기반)$/,
    /^제\d+회/,
    /^올해/,
    /^내년/,
    /^국내/,
    /^글로벌/,
    /^한국/,
    /^서울/,
    /^정부/,
    /^금융위원회/,
    /^금융감독원/,
    /^중소벤처기업부/
  ];

  if (
    invalidPatterns.some((pattern) =>
      pattern.test(name)
    )
  ) {
    return false;
  }

  return true;
}


/*
 * =========================================================
 * 뉴스 중복 제거
 * =========================================================
 */

function deduplicateNews(news) {
  const map = new Map();

  for (const item of news) {
    const key = item.link || item.title;

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}


/*
 * =========================================================
 * 기업 ID
 * =========================================================
 */

function makeId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}


/*
 * =========================================================
 * 기업 설명
 * =========================================================
 */

function createDescription(company) {
  const parts = [];

  if (company.commerce) {
    parts.push("커머스");
  }

  if (company.subscription) {
    parts.push("구독");
  }

  if (company.b2b) {
    parts.push("B2B");
  }

  if (company.mobileApp) {
    parts.push("모바일 앱");
  }

  if (company.donation) {
    parts.push("기부·후원");
  }

  if (parts.length === 0) {
    parts.push(company.industry);
  }

  return `${parts.join(", ")} 관련 외부 활동이 확인된 제휴 후보 기업`;
}


/*
 * =========================================================
 * 메인
 * =========================================================
 */

async function main() {
  console.log("");
  console.log("==============================================");
  console.log(" KB스타플랫폼 제휴 후보 기업 발굴 시작");
  console.log("==============================================");
  console.log("");

  const companyMap = new Map();

  /*
   * -------------------------------------------------------
   * 1. 외부 뉴스 수집
   * -------------------------------------------------------
   */

  for (const query of discoveryQueries) {
    try {
      const newsItems = await fetchNews(query);

      console.log(
        `  → ${newsItems.length}건 수집`
      );

      for (const news of newsItems) {
        const candidates =
          extractCompanyCandidates(news.title);

        for (const companyName of candidates) {
          const key = companyName.toLowerCase();

          if (!companyMap.has(key)) {
            companyMap.set(key, {
              name: companyName,
              queries: [],
              news: []
            });
          }

          const company =
            companyMap.get(key);

          if (!company.queries.includes(query)) {
            company.queries.push(query);
          }

          company.news.push({
            ...news,
            query
          });
        }
      }

      /*
       * Google News에 과도한 요청을 보내지 않도록
       * 쿼리 사이에 잠깐 대기
       */
      await sleep(300);

    } catch (error) {
      console.error(
        `  ✕ 검색 실패: ${query}`
      );

      console.error(error.message);
    }
  }


  /*
   * -------------------------------------------------------
   * 2. 기업별 데이터 집계
   * -------------------------------------------------------
   */

  const companies = [];

  for (const company of companyMap.values()) {
    company.news = deduplicateNews(company.news);

    /*
     * 최소 언급 횟수
     */
    if (company.news.length < MIN_MENTIONS) {
      continue;
    }

    /*
     * 전체 텍스트
     */
    const allText = [
      company.name,
      ...company.queries,
      ...company.news.map((item) => item.title),
      ...company.news.map((item) => item.description)
    ].join(" ");

    company.industry =
      inferIndustry(allText);

    /*
     * 최근 뉴스가 많을수록 높은 활동 점수
     */
    const newsCount =
      company.news.length;

    const newsActivityScore =
      Math.min(
        100,
        30 + newsCount * 8
      );

    /*
     * 제휴 적합성
     */
    const fit =
      analyzePartnershipFit(company);

    /*
     * 최근 뉴스 순 정렬
     */
    company.news.sort((a, b) => {
      const dateA =
        new Date(a.pubDate || 0).getTime();

      const dateB =
        new Date(b.pubDate || 0).getTime();

      return dateB - dateA;
    });

    /*
     * 최종 기업 객체
     */
    companies.push({
      id: makeId(company.name),

      name: company.name,

      industry: company.industry,

      description: createDescription({
        ...company,
        ...fit
      }),

      /*
       * 기존 화면과의 호환성을 위해 유지
       */
      newsCount,

      newsActivityScore,

      /*
       * 기존 interestScore 대신
       * KB스타플랫폼 제휴 적합도를 사용
       */
      interestScore:
        fit.partnershipScore,

      /*
       * 신규 핵심 필드
       */
      partnershipScore:
        fit.partnershipScore,

      paymentNeed:
        fit.paymentNeed,

      onlineService:
        fit.onlineService,

      mobileApp:
        fit.mobileApp,

      subscription:
        fit.subscription,

      b2b:
        fit.b2b,

      commerce:
        fit.commerce,

      donation:
        fit.donation,

      fitServices:
        fit.fitServices,

      discoverySignals:
        fit.discoverySignals,

      discoveryReason:
        fit.discoveryReason,

      discoveryQueries:
        company.queries,

      latestNews:
        company.news.slice(0, 5).map((item) => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate
        }))
    });
  }


  /*
   * -------------------------------------------------------
   * 3. 제휴 적합도 기준 정렬
   * -------------------------------------------------------
   */

  companies.sort((a, b) => {
    if (
      b.partnershipScore !==
      a.partnershipScore
    ) {
      return (
        b.partnershipScore -
        a.partnershipScore
      );
    }

    return (
      b.newsActivityScore -
      a.newsActivityScore
    );
  });


  /*
   * -------------------------------------------------------
   * 4. 상위 후보만 저장
   * -------------------------------------------------------
   */

  const finalCompanies =
    companies.slice(0, MAX_COMPANIES);


  /*
   * -------------------------------------------------------
   * 5. JSON 저장
   * -------------------------------------------------------
   */

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      finalCompanies,
      null,
      2
    ),
    "utf8"
  );


  /*
   * -------------------------------------------------------
   * 6. 결과 출력
   * -------------------------------------------------------
   */

  console.log("");
  console.log("==============================================");
  console.log(" 제휴 후보 기업 발굴 완료");
  console.log("==============================================");

  console.log(
    `전체 후보 기업: ${companies.length}개`
  );

  console.log(
    `저장 기업: ${finalCompanies.length}개`
  );

  console.log("");

  finalCompanies
    .slice(0, 20)
    .forEach((company, index) => {
      console.log(
        `${index + 1}. ${company.name}`
      );

      console.log(
        `   제휴 적합도: ${company.partnershipScore}`
      );

      console.log(
        `   업종: ${company.industry}`
      );

      console.log(
        `   추천 서비스: ${
          company.fitServices.join(", ") || "-"
        }`
      );

      console.log(
        `   근거: ${
          company.discoverySignals
            .slice(0, 3)
            .join(", ") || "-"
        }`
      );

      console.log("");
    });

  console.log(
    `저장 위치: ${OUTPUT_FILE}`
  );
}


/*
 * =========================================================
 * 유틸
 * =========================================================
 */

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}


main().catch((error) => {
  console.error("");
  console.error(
    "제휴 후보 발굴 중 오류가 발생했습니다."
  );

  console.error(error);

  process.exit(1);
});