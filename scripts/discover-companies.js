const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

const OUTPUT_FILE = path.join(__dirname, "../data/companies.json");
const RSS_BASE_URL = "https://news.google.com/rss/search";
const NEWS_PERIOD = "when:14d";
const MAX_NEWS_PER_QUERY = 25;
const MAX_COMPANIES = 40;
const MIN_MENTIONS = 2;

/*
 * KB스타플랫폼의 실제 가맹점 후보를 찾기 위한 검색어입니다.
 *
 * 핵심 기준
 * 1) 상품/서비스를 실제로 판매하는 사업자
 * 2) 온라인몰/자사몰/앱/예약/티켓 등 거래가 발생하는 채널 보유
 * 3) 결제 수요가 보이는 기업
 * 4) 최근 신규 상품/서비스/온라인 판매 확대 등 제휴 타이밍이 보이는 기업
 *
 * 금융사·통신사·빅테크·결제사업자 자체를 찾는 검색어는 의도적으로 제외합니다.
 */
const discoveryQueries = [
  "온라인몰 신규 상품 출시",
  "자사몰 신규 상품 출시",
  "브랜드몰 온라인 판매 확대",
  "온라인 쇼핑몰 사업 확대",
  "D2C 브랜드 온라인 판매 확대",
  "온라인 커머스 신규 브랜드 출시",
  "모바일 쇼핑몰 신규 서비스",
  "온라인 주문 서비스 출시",
  "온라인 예약 서비스 출시",
  "예약 플랫폼 신규 상품 출시",
  "숙박 예약 서비스 신규 상품",
  "여행 상품 온라인 판매 확대",
  "티켓 예매 서비스 출시",
  "공연 티켓 온라인 판매",
  "교육 수강권 온라인 판매",
  "온라인 클래스 신규 상품",
  "헬스케어 서비스 이용권 출시",
  "레저 이용권 온라인 판매",
  "회원권 온라인 판매",
  "정기구독 상품 출시",
  "구독형 상품 출시",
  "월 구독 서비스 신규 출시",
  "멤버십 상품 출시 온라인",
  "온라인 결제 도입 쇼핑몰",
  "온라인 결제 도입 브랜드",
  "모바일 결제 도입 쇼핑몰",
  "자사몰 결제 시스템 도입",
  "온라인 판매 신규 진출 기업",
  "소비자 대상 신규 서비스 출시",
  "소비자 대상 온라인 서비스 출시"
];

/* 명백히 가맹점 발굴 대상이 아닌 회사/업종 */
const excludedCompanyNames = new Set([
  "카카오", "네이버", "메타", "페이스북", "아마존", "amazon",
  "SK텔레콤", "SKT", "KT", "LG유플러스",
  "카카오페이", "네이버페이", "토스", "토스페이", "케이뱅크",
  "KB국민은행", "신한은행", "하나은행", "우리은행", "NH농협은행",
  "삼성카드", "현대카드", "신한카드", "KB국민카드",
  "비자", "마스터카드", "VISA", "Mastercard",
  "KG이니시스", "토스페이먼츠", "NHN KCP", "나이스페이",
  "다날", "헥토파이낸셜", "카페24", "NHN", "쿠팡이츠"
]);

/* 제목/본문에 아래 표현이 강하게 나오면 '결제사업자 또는 자체 결제 인프라'로 간주 */
const paymentProviderKeywords = [
  "결제대행", "pg사", "pg 사업", "pg서비스", "전자지급결제대행",
  "결제 플랫폼", "결제 인프라", "결제 솔루션", "결제 솔루션 사업",
  "자체 결제 시스템", "자체 결제시스템", "자체 결제 서비스",
  "자체 간편결제", "자체 페이", "페이 서비스", "간편결제 서비스",
  "결제수단을 직접", "결제사업", "결제 사업자", "결제 전문"
];

/* 뉴스에서 기존 결제수단 구축/운영이 확인되면 후보 점수를 크게 낮춤 */
const existingPaymentKeywords = [
  "자체 결제 시스템", "자체 결제시스템", "자체 결제 서비스",
  "자체 간편결제", "자체 페이", "페이 출시", "페이 서비스 출시",
  "결제 시스템 구축", "결제시스템 구축", "결제 플랫폼 구축",
  "결제 인프라 구축", "간편결제 구축", "결제수단 구축",
  "pg 연동", "pg사 연동", "결제대행 연동", "결제 모듈 구축"
];

const merchantPositiveKeywords = [
  "쇼핑몰", "온라인몰", "자사몰", "브랜드몰", "상품", "제품",
  "판매", "주문", "구매", "장바구니", "배송", "예약", "예매",
  "티켓", "입장권", "이용권", "수강권", "회원권", "숙박", "객실",
  "여행상품", "패키지", "구독상품", "정기구독", "멤버십", "수강료",
  "서비스 이용료", "온라인 판매", "소비자 대상"
];

const merchantNegativeKeywords = [
  "핀테크", "금융지주", "은행", "카드사", "증권사", "보험사",
  "통신사", "통신", "ai 모델", "ai 플랫폼", "클라우드",
  "데이터센터", "반도체", "소프트웨어 솔루션", "결제 솔루션",
  "pg", "결제대행", "핀테크 플랫폼", "금융 플랫폼"
];

const industryRules = [
  { name: "패션/뷰티", keys: ["패션", "의류", "뷰티", "화장품", "브랜드", "잡화"] },
  { name: "식품/식음료", keys: ["식품", "푸드", "식음료", "간편식", "베이커리", "커피"] },
  { name: "홈리빙", keys: ["가구", "인테리어", "홈리빙", "생활용품", "리빙"] },
  { name: "여행/숙박", keys: ["여행", "숙박", "호텔", "리조트", "관광", "항공"] },
  { name: "교육", keys: ["교육", "학원", "강의", "클래스", "수강", "학습"] },
  { name: "레저/티켓", keys: ["레저", "티켓", "공연", "전시", "입장권", "예매"] },
  { name: "헬스케어", keys: ["헬스", "건강", "의료", "피트니스", "병원"] },
  { name: "반려동물", keys: ["반려동물", "펫", "강아지", "고양이"] },
  { name: "서비스/예약", keys: ["예약", "방문", "출장", "청소", "세차", "돌봄"] }
];

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(name) {
  return name
    .replace(/["'“”‘’]/g, "")
    .replace(/^(주식회사|㈜)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isExcludedName(name) {
  const n = normalizeName(name).toLowerCase();
  if (excludedCompanyNames.has(name)) return true;
  return [...excludedCompanyNames].some(x => n === String(x).toLowerCase());
}

function isValidCompanyName(name) {
  const n = normalizeName(name);
  if (!n || n.length < 2 || n.length > 30) return false;
  if (isExcludedName(n)) return false;
  if (/^(온라인|모바일|디지털|신규|기업|서비스|플랫폼|상품|브랜드|시장|업계|소비자)/.test(n)) return false;
  if (/(출시|확대|도입|판매|사업|시장|관련|기반|기업들|업계)$/.test(n)) return false;
  if (/^(정부|한국|국내|서울|금융위원회|금융감독원|중소벤처기업부)/.test(n)) return false;
  return true;
}

function extractCompanyCandidates(title) {
  const candidates = [];

  // "기업명, ..." / "기업명: ..."
  const prefix = title.match(/^([가-힣A-Za-z0-9][가-힣A-Za-z0-9&.()·\- ]{1,24}?)[,，:：]/);
  if (prefix) candidates.push(prefix[1]);

  // "기업명은/는/이/가 ..."
  const subject = title.match(/^([가-힣A-Za-z0-9][가-힣A-Za-z0-9&.()·\- ]{1,22}?)(?:은|는|이|가)\s/);
  if (subject) candidates.push(subject[1]);

  // "주식회사 XXX"
  const corp = title.match(/(?:주식회사|㈜)\s*([가-힣A-Za-z0-9&.()·\-]{2,30})/);
  if (corp) candidates.push(corp[1]);

  return [...new Set(candidates.map(normalizeName).filter(isValidCompanyName))];
}

function inferIndustry(text) {
  const value = text.toLowerCase();
  for (const rule of industryRules) {
    if (rule.keys.some(key => value.includes(key.toLowerCase()))) return rule.name;
  }
  return "기타 소비자 서비스";
}

function countMatches(text, keywords) {
  const value = text.toLowerCase();
  return keywords.filter(k => value.includes(k.toLowerCase())).length;
}

function analyzeMerchantFit(company) {
  const text = [
    company.name,
    ...company.queries,
    ...company.news.map(n => n.title),
    ...company.news.map(n => n.description || "")
  ].join(" ");

  const positive = countMatches(text, merchantPositiveKeywords);
  const negative = countMatches(text, merchantNegativeKeywords);
  const provider = countMatches(text, paymentProviderKeywords);
  const existingPayment = countMatches(text, existingPaymentKeywords);

  let score = 0;
  const signals = [];

  // 실제 판매/거래 신호를 가장 크게 반영
  score += Math.min(40, positive * 8);
  if (positive > 0) signals.push("상품·서비스 판매/거래 신호");

  if (/온라인몰|자사몰|브랜드몰|쇼핑몰|온라인 판매|온라인 주문|온라인 예약/i.test(text)) {
    score += 20;
    signals.push("온라인 판매 채널 확인");
  }

  if (/상품|제품|판매|주문|구매|예약|예매|티켓|입장권|이용권|수강권|숙박|회원권/i.test(text)) {
    score += 15;
    signals.push("고객 결제가 발생하는 상품/서비스");
  }

  if (/신규 상품|신상품|신규 서비스|출시|사업 확대|온라인 판매 확대|자사몰 확대/i.test(text)) {
    score += 10;
    signals.push("최근 상품·서비스 확대 신호");
  }

  // 금융/통신/결제사업자는 강하게 제외
  score -= Math.min(45, negative * 18);
  score -= Math.min(60, provider * 25);

  if (negative > 0) signals.push("금융·통신·결제사업자 성격");
  if (provider > 0) signals.push("결제 인프라/결제사업 관련 신호");

  // 자체 결제 구축이 명시적으로 확인되면 사실상 탈락
  const paymentSystemStatus = existingPayment > 0
    ? "existing"
    : provider > 0
      ? "provider"
      : "unknown";

  if (existingPayment > 0) {
    score -= 70;
    signals.push("기존 자체 결제 시스템/결제 인프라 확인");
  }

  // 명백한 제외 업종은 0점 처리
  if (negative >= 2 || provider >= 2 || paymentSystemStatus === "existing") {
    score = 0;
  }

  score = Math.max(0, Math.min(100, score));

  const fitServices = [];
  if (score >= 50) fitServices.push("브랜드Pay");
  if (/구독|정기구독|멤버십/i.test(text) && score >= 45) fitServices.push("정기결제");
  if (score >= 50) fitServices.push("현금영수증");
  if (score >= 50) fitServices.push("결제·정산 관리");

  const discoveryReason = score >= 50
    ? `${company.name}은(는) ${signals.slice(0, 3).join(", ")}이 확인되어 실제 상품·서비스 결제가 발생하는 가맹점 후보로 분류했습니다.`
    : "공개 뉴스만으로 KB스타플랫폼 가맹점 후보로 보기 어려워 우선순위를 낮췄습니다.";

  return {
    merchantFitScore: score,
    partnershipScore: score,
    paymentNeed: positive > 0 || /결제|주문|구매|판매|예약|예매/i.test(text),
    onlineService: /온라인|자사몰|브랜드몰|쇼핑몰|모바일/i.test(text),
    subscription: /구독|정기구독|멤버십/i.test(text),
    existingPaymentSystem: paymentSystemStatus === "existing",
    paymentSystemStatus,
    fitServices: [...new Set(fitServices)],
    discoverySignals: signals,
    discoveryReason
  };
}

async function fetchNews(query) {
  const url = `${RSS_BASE_URL}?q=${encodeURIComponent(`${query} ${NEWS_PERIOD}`)}&hl=ko&gl=KR&ceid=KR:ko`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google News 요청 실패: ${response.status}`);
  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const raw = parsed?.rss?.channel?.item || [];
  const items = Array.isArray(raw) ? raw : [raw];

  return items.slice(0, MAX_NEWS_PER_QUERY).map(item => ({
    title: cleanText(item.title),
    link: item.link || "",
    pubDate: item.pubDate || "",
    description: cleanText(item.description || "")
  })).filter(item => item.title);
}

function dedupeNews(news) {
  const map = new Map();
  for (const item of news) {
    const key = item.link || item.title;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function makeId(name) {
  return name.toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("==============================================");
  console.log(" KB스타플랫폼 가맹점 후보 발굴 시작");
  console.log("==============================================");

  const companyMap = new Map();

  for (const query of discoveryQueries) {
    try {
      console.log(`뉴스 검색: ${query}`);
      const newsItems = await fetchNews(query);

      for (const news of newsItems) {
        for (const name of extractCompanyCandidates(news.title)) {
          const key = name.toLowerCase();
          if (!companyMap.has(key)) {
            companyMap.set(key, { name, queries: [], news: [] });
          }
          const company = companyMap.get(key);
          if (!company.queries.includes(query)) company.queries.push(query);
          company.news.push({ ...news, query });
        }
      }

      await sleep(300);
    } catch (error) {
      console.error(`검색 실패: ${query} / ${error.message}`);
    }
  }

  const candidates = [];

  for (const company of companyMap.values()) {
    company.news = dedupeNews(company.news);
    if (company.news.length < MIN_MENTIONS) continue;

    const fit = analyzeMerchantFit(company);
    if (fit.merchantFitScore < 35) continue;
    if (fit.paymentSystemStatus === "existing") continue;
    if (fit.paymentSystemStatus === "provider") continue;

    const allText = [company.name, ...company.queries, ...company.news.map(n => n.title), ...company.news.map(n => n.description)].join(" ");
    company.news.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    const newsActivityScore = Math.min(100, 30 + company.news.length * 8);

    candidates.push({
      id: makeId(company.name),
      name: company.name,
      industry: inferIndustry(allText),
      description: "실제 상품·서비스 판매 또는 고객 결제가 발생하는 것으로 보이는 가맹점 후보",
      newsCount: company.news.length,
      newsActivityScore,
      interestScore: fit.merchantFitScore,
      partnershipScore: fit.partnershipScore,
      merchantFitScore: fit.merchantFitScore,
      paymentNeed: fit.paymentNeed,
      onlineService: fit.onlineService,
      subscription: fit.subscription,
      existingPaymentSystem: fit.existingPaymentSystem,
      paymentSystemStatus: fit.paymentSystemStatus,
      fitServices: fit.fitServices,
      discoverySignals: fit.discoverySignals,
      discoveryReason: fit.discoveryReason,
      discoveryQueries: company.queries,
      latestNews: company.news.slice(0, 5).map(n => ({
        title: n.title,
        link: n.link,
        pubDate: n.pubDate
      }))
    });
  }

  candidates.sort((a, b) => {
    if (b.merchantFitScore !== a.merchantFitScore) return b.merchantFitScore - a.merchantFitScore;
    if (b.newsActivityScore !== a.newsActivityScore) return b.newsActivityScore - a.newsActivityScore;
    return b.newsCount - a.newsCount;
  });

  const finalCompanies = candidates.slice(0, MAX_COMPANIES);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalCompanies, null, 2), "utf8");

  console.log(`전체 후보: ${candidates.length}개`);
  console.log(`최종 저장: ${finalCompanies.length}개`);
  console.log("");

  finalCompanies.slice(0, 20).forEach((company, index) => {
    console.log(`${index + 1}. ${company.name} / 가맹점 적합도 ${company.merchantFitScore}`);
    console.log(`   ${company.industry} / ${company.fitServices.join(", ") || "서비스 미정"}`);
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
