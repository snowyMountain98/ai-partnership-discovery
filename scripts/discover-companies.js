const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

const OUTPUT_FILE = path.join(__dirname, "../data/companies.json");
const RSS_BASE_URL = "https://news.google.com/rss/search";
const NEWS_PERIOD = "when:30d";
const MAX_NEWS_PER_QUERY = 30;
const MAX_COMPANIES = 40;
const MIN_MENTIONS = 2;

/*
 * KB스타플랫폼 기존 거래사에서 발견한 '거래처 패턴'을 검색 로직에 반영한다.
 * 이 목록 자체를 다시 후보로 보여주는 것이 아니라, 이미 거래 중인 회사는 제외하고
 * 비슷한 사업 형태의 신규 후보를 찾는 용도로 사용한다.
 *
 * 사용자 제공 최근 1년 거래량 상위 기업을 기반으로 한 분류:
 * - 패션/생활/소비재 판매
 * - 식품/외식/프랜차이즈
 * - B2B 유통/업무 플랫폼
 * - 의약품/헬스케어 유통
 * - 교육/돌봄/공공서비스
 * - 커피/식음료
 * - 대형 유통/그룹 계열 소비자 사업
 */
const existingStarPlatformPartners = [
  "주식회사 위비스", "위비스",
  "주식회사 리테일앤인사이트", "리테일앤인사이트",
  "에스앤이컴퍼니", "S&E컴퍼니",
  "주식회사 바로팜", "바로팜",
  "주식회사 엔라인", "엔라인", "난닝구", "줄로그",
  "주식회사 제너시스비비큐", "제너시스비비큐", "제너시스BBQ", "BBQ",
  "아트박스",
  "페이민트 주식회사", "페이민트",
  "상하농원", "상하농원(유)",
  "남양유업",
  "비누커머스 주식회사", "비누커머스",
  "오뚜기",
  "주식회사 에이케이인터렉티브", "에이케이인터렉티브",
  "여성가족부", "아이돌봄",
  "주식회사 먹깨비", "먹깨비",
  "대상웰라이프 주식회사", "대상웰라이프",
  "SCK컴퍼니",
  "GS그룹", "GS리테일", "GS Pay"
];

/* 명백한 비대상 사업자 */
const excludedCompanyNames = [
  ...existingStarPlatformPartners,
  "카카오", "네이버", "메타", "페이스북", "인스타그램", "아마존", "amazon",
  "구글", "애플", "마이크로소프트",
  "SK텔레콤", "SKT", "KT", "LG유플러스", "LG U+",
  "카카오페이", "네이버페이", "토스", "토스페이", "케이뱅크",
  "KB국민은행", "신한은행", "하나은행", "우리은행", "NH농협은행",
  "삼성카드", "현대카드", "신한카드", "KB국민카드",
  "비자", "마스터카드", "VISA", "Mastercard",
  "KG이니시스", "토스페이먼츠", "NHN KCP", "나이스페이",
  "다날", "헥토파이낸셜", "카페24", "NHN"
];

/*
 * 거래사 패턴을 직접 검색한다.
 * '결제회사'가 아니라 '결제를 받는 사업자'가 검색되도록 구성한다.
 */
const discoveryQueries = [
  // 패션/리테일/D2C
  "패션 브랜드 자사몰 신규 상품 판매 확대",
  "의류 브랜드 온라인몰 신규 상품 출시",
  "뷰티 브랜드 자사몰 온라인 판매 확대",
  "생활용품 브랜드 온라인몰 신규 상품",
  "잡화 브랜드 온라인 판매 확대",
  "D2C 브랜드 자사몰 판매 확대",
  "소비재 브랜드 자사몰 출시",
  "브랜드 공식몰 온라인 판매 확대",

  // 식품/식음료/프랜차이즈
  "식품 브랜드 온라인몰 판매 확대",
  "식품기업 자사몰 신규 상품 출시",
  "간편식 온라인몰 신규 상품 출시",
  "식음료 브랜드 온라인 주문 확대",
  "외식 프랜차이즈 앱 주문 서비스",
  "프랜차이즈 자체 앱 주문 서비스",
  "커피 브랜드 모바일 주문 서비스",
  "베이커리 온라인 주문 서비스",
  "외식업체 온라인 주문 서비스 출시",

  // B2B 유통/업무 플랫폼 - 실제 상품 거래가 있는 경우
  "B2B 유통 플랫폼 상품 주문 서비스",
  "B2B 상품 주문 플랫폼 출시",
  "기업 대상 상품 주문 플랫폼 확대",
  "도매 온라인몰 신규 상품 판매",
  "사업자 전용 온라인몰 상품 판매",
  "약국 의약품 주문 플랫폼",
  "병원 대상 상품 주문 플랫폼",
  "사업자 대상 식자재 온라인 주문",

  // 교육/돌봄/공공서비스 - 유료 또는 결제형 서비스
  "교육 서비스 수강권 온라인 판매",
  "온라인 교육 수강권 신규 상품",
  "학원 모바일 결제 서비스",
  "돌봄 서비스 이용료 온라인 결제",
  "공공 서비스 이용료 온라인 결제",
  "문화센터 수강권 온라인 판매",

  // 여행/예약/레저/티켓
  "숙박 예약 온라인 판매 확대",
  "여행 상품 온라인 판매 확대",
  "레저 이용권 온라인 판매",
  "관광시설 입장권 온라인 판매",
  "공연 티켓 온라인 판매 확대",
  "전시 티켓 온라인 판매",
  "스포츠 이용권 온라인 판매",
  "예약 서비스 신규 상품 출시",

  // 구독/멤버십
  "소비재 정기구독 상품 출시",
  "식품 정기구독 상품 출시",
  "생활용품 정기구독 서비스",
  "멤버십 유료 상품 출시",
  "월 구독 상품 온라인 판매",

  // 결제 도입 '수요자' 중심
  "온라인몰 간편결제 도입",
  "브랜드 자사몰 간편결제 도입",
  "쇼핑몰 결제 편의성 개선",
  "온라인 주문 결제 편의성 개선",
  "모바일 주문 결제 서비스 도입"
];

/* 결제사업자/자체 Pay/자체 결제 인프라 신호 */
const paymentProviderKeywords = [
  "결제대행", "pg사", "pg 사업", "전자지급결제대행", "결제 솔루션 사업",
  "결제 인프라 사업", "결제 플랫폼 사업", "핀테크 사업", "전자금융업",
  "간편결제 사업자", "결제사업자", "결제 전문기업", "결제 서비스 기업"
];

const ownPaymentKeywords = [
  "자체 결제 시스템", "자체 결제시스템", "자체 결제 서비스", "자체 간편결제",
  "자체 페이", "자체pay", "자체 pay", "자체 결제수단", "자사 결제 시스템",
  "자사 결제시스템", "결제 시스템 구축", "결제시스템 구축", "결제 플랫폼 구축",
  "간편결제 구축", "자체 결제 인프라", "자체 결제 솔루션", "페이 출시"
];

/* 실제 상품/용역 거래 신호 */
const transactionKeywords = [
  "상품", "제품", "판매", "주문", "구매", "배송", "쇼핑몰", "온라인몰", "자사몰",
  "브랜드몰", "공식몰", "매장", "가맹점", "프랜차이즈", "예약", "예매", "티켓",
  "입장권", "이용권", "수강권", "수강료", "숙박", "객실", "여행상품", "패키지",
  "회원권", "멤버십", "구독", "정기구독", "식자재", "도매", "소매", "주문앱",
  "모바일 주문", "배달", "돌봄 서비스", "이용료"
];

const digitalChannelKeywords = [
  "온라인몰", "자사몰", "브랜드몰", "공식몰", "쇼핑몰", "온라인 주문", "주문앱",
  "모바일 주문", "앱 주문", "예약앱", "온라인 예약", "온라인 예매", "모바일 앱",
  "웹사이트", "플랫폼", "온라인 판매"
];

const merchantNegativeKeywords = [
  "은행", "카드사", "증권사", "보험사", "금융지주", "통신사", "통신",
  "pg", "결제대행", "결제 솔루션", "결제 플랫폼", "핀테크", "전자금융",
  "클라우드", "데이터센터", "반도체", "보안 솔루션", "인증 솔루션"
];

const industryRules = [
  { name: "패션/뷰티", keys: ["패션", "의류", "뷰티", "화장품", "잡화", "패션 브랜드"] },
  { name: "식품/식음료", keys: ["식품", "푸드", "식음료", "간편식", "베이커리", "커피", "식자재"] },
  { name: "생활/리테일", keys: ["생활용품", "리빙", "문구", "잡화", "유통", "리테일"] },
  { name: "B2B 유통", keys: ["B2B", "도매", "사업자 전용", "기업 대상", "약국", "병원", "유통 플랫폼"] },
  { name: "교육/돌봄", keys: ["교육", "학원", "강의", "클래스", "수강", "돌봄", "아이돌봄"] },
  { name: "여행/숙박", keys: ["여행", "숙박", "호텔", "리조트", "관광"] },
  { name: "레저/티켓", keys: ["레저", "티켓", "공연", "전시", "입장권", "예매", "스포츠"] },
  { name: "헬스케어", keys: ["헬스", "건강", "의료", "피트니스", "병원", "약국"] },
  { name: "서비스/예약", keys: ["예약", "방문", "출장", "청소", "세차", "돌봄", "이용료"] }
];

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

function normalizeName(name) {
  return String(name || "")
    .replace(/["'“”‘’]/g, "")
    .replace(/^(주식회사|㈜|유한회사)\s*/i, "")
    .replace(/\s+/g, " ").trim();
}

function normalizeKey(name) {
  return normalizeName(name).toLowerCase().replace(/[\s().,&\-]/g, "");
}

const excludedKeys = new Set(excludedCompanyNames.map(normalizeKey));

function isExcludedName(name) {
  const key = normalizeKey(name);
  if (excludedKeys.has(key)) return true;
  return [...excludedKeys].some(excluded => key === excluded || key.includes(excluded) || excluded.includes(key));
}

function isValidCompanyName(name) {
  const n = normalizeName(name);
  if (!n || n.length < 2 || n.length > 30) return false;
  if (isExcludedName(n)) return false;
  if (/^(온라인|모바일|디지털|신규|기업|서비스|플랫폼|상품|브랜드|시장|업계|소비자|국내|글로벌)/.test(n)) return false;
  if (/(출시|확대|도입|판매|사업|시장|관련|기반|기업들|업계)$/.test(n)) return false;
  if (/^(정부|한국|서울|금융위원회|금융감독원|중소벤처기업부|과학기술정보통신부)/.test(n)) return false;
  return true;
}

function extractCompanyCandidates(title) {
  const candidates = [];

  // 제목 선두: "회사명, ..."
  const prefix = title.match(/^([가-힣A-Za-z0-9][가-힣A-Za-z0-9&.()·\- ]{1,24}?)[,，:：]/);
  if (prefix) candidates.push(prefix[1]);

  // "회사명은/는/이/가 ..."
  const subject = title.match(/^([가-힣A-Za-z0-9][가-힣A-Za-z0-9&.()·\- ]{1,22}?)(?:은|는|이|가)\s/);
  if (subject) candidates.push(subject[1]);

  // "주식회사 XXX"
  const corp = title.match(/(?:주식회사|㈜|유한회사)\s*([가-힣A-Za-z0-9&.()·\-]{2,30})/);
  if (corp) candidates.push(corp[1]);

  return [...new Set(candidates.map(normalizeName).filter(isValidCompanyName))];
}

function inferIndustry(text) {
  const value = text.toLowerCase();
  for (const rule of industryRules) {
    if (rule.keys.some(key => value.includes(key.toLowerCase()))) return rule.name;
  }
  return "소비자/거래 서비스";
}

function countMatches(text, keywords) {
  const value = text.toLowerCase();
  return keywords.reduce((count, keyword) => count + (value.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

function analyzeMerchantFit(company) {
  const text = [
    company.name,
    ...company.queries,
    ...company.news.map(n => n.title),
    ...company.news.map(n => n.description || "")
  ].join(" ");

  const transaction = countMatches(text, transactionKeywords);
  const digitalChannel = countMatches(text, digitalChannelKeywords);
  const negative = countMatches(text, merchantNegativeKeywords);
  const provider = countMatches(text, paymentProviderKeywords);
  const ownPayment = countMatches(text, ownPaymentKeywords);

  let score = 0;
  const signals = [];

  // 거래 자체를 최우선으로 본다.
  if (transaction >= 1) {
    score += Math.min(35, transaction * 5);
    signals.push("상품·서비스 거래 신호");
  }
  if (transaction >= 3) {
    score += 10;
    signals.push("반복적인 판매/주문 신호");
  }

  // 디지털 판매채널은 스타플랫폼 적용 가능성을 높인다.
  if (digitalChannel >= 1) {
    score += 20;
    signals.push("온라인 판매·주문 채널 신호");
  }
  if (digitalChannel >= 2) score += 10;

  // 신규 상품/서비스/판매 확대 = 영업 타이밍 신호
  if (/신규 상품|신상품|신규 서비스|출시|온라인 판매 확대|사업 확대|신규 매장|앱 주문|온라인 주문/i.test(text)) {
    score += 10;
    signals.push("최근 판매채널/상품 확대 신호");
  }

  // 구독/회원권/이용권은 정기결제 후보
  if (/구독|정기구독|멤버십|회원권/i.test(text)) {
    score += 10;
    signals.push("구독·멤버십 거래 신호");
  }

  // B2B 거래도 실제 상품 주문이 있으면 후보가 될 수 있음
  if (/B2B|도매|사업자 전용|기업 대상|약국|병원|식자재/i.test(text) && /주문|상품|판매|구매|유통/i.test(text)) {
    score += 10;
    signals.push("B2B 상품 주문/유통 신호");
  }

  // 비대상 사업자는 강하게 감점
  score -= Math.min(60, negative * 20);
  score -= Math.min(70, provider * 35);

  if (negative > 0) signals.push("금융·통신·결제사업자 성격 신호");
  if (provider > 0) signals.push("결제사업자/결제 인프라 신호");

  const paymentSystemStatus = ownPayment > 0 ? "existing" : provider > 0 ? "provider" : "unknown";

  // 자체 결제시스템이 명시적으로 확인되면 신규 가맹점 후보에서 제외
  if (ownPayment > 0) {
    score -= 80;
    signals.push("기존 자체 결제시스템/자체 Pay 확인");
  }

  if (negative >= 2 || provider >= 1 || paymentSystemStatus === "existing") score = 0;

  score = Math.max(0, Math.min(100, score));

  const fitServices = [];
  if (score >= 55) fitServices.push("브랜드Pay");
  if (/구독|정기구독|멤버십/i.test(text) && score >= 50) fitServices.push("정기결제");
  if (/B2B|법인|사업자 전용/i.test(text) && score >= 55) fitServices.push("법인결제(B2B)");
  if (score >= 50) fitServices.push("현금영수증", "결제·정산 관리");

  return {
    merchantFitScore: score,
    partnershipScore: score,
    paymentNeed: transaction > 0,
    onlineService: digitalChannel > 0,
    subscription: /구독|정기구독|멤버십/i.test(text),
    b2b: /B2B|도매|사업자 전용|기업 대상/i.test(text),
    existingPaymentSystem: paymentSystemStatus === "existing",
    paymentSystemStatus,
    fitServices: [...new Set(fitServices)],
    discoverySignals: signals,
    discoveryReason: score >= 55
      ? `${company.name}은(는) ${signals.slice(0, 3).join(", ")}이 확인되어 KB스타플랫폼 가맹점 후보로 분류했습니다.`
      : "외부 뉴스에서 거래 신호가 충분하지 않거나 비대상 업종 신호가 확인되어 우선순위를 낮췄습니다."
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
  return normalizeName(name).toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("==============================================");
  console.log(" KB스타플랫폼 신규 가맹점 후보 발굴");
  console.log(" 거래사 패턴 기반 Discovery v3");
  console.log("==============================================");

  const companyMap = new Map();

  for (const query of discoveryQueries) {
    try {
      console.log(`뉴스 검색: ${query}`);
      const newsItems = await fetchNews(query);

      for (const news of newsItems) {
        for (const rawName of extractCompanyCandidates(news.title)) {
          const name = normalizeName(rawName);
          if (isExcludedName(name)) continue;

          const key = normalizeKey(name);
          if (!companyMap.has(key)) companyMap.set(key, { name, queries: [], news: [] });
          const company = companyMap.get(key);
          if (!company.queries.includes(query)) company.queries.push(query);
          company.news.push({ ...news, query });
        }
      }

      await sleep(350);
    } catch (error) {
      console.error(`검색 실패: ${query} / ${error.message}`);
    }
  }

  const candidates = [];

  for (const company of companyMap.values()) {
    company.news = dedupeNews(company.news);
    if (company.news.length < MIN_MENTIONS) continue;

    const fit = analyzeMerchantFit(company);
    if (fit.merchantFitScore < 45) continue;
    if (fit.paymentSystemStatus === "existing" || fit.paymentSystemStatus === "provider") continue;

    const allText = [company.name, ...company.queries, ...company.news.map(n => n.title), ...company.news.map(n => n.description)].join(" ");
    company.news.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    const newsActivityScore = Math.min(100, 25 + company.news.length * 7);

    candidates.push({
      id: makeId(company.name),
      name: company.name,
      industry: inferIndustry(allText),
      description: "기존 KB스타플랫폼 거래사와 유사한 상품·서비스 거래 구조를 가진 신규 가맹점 후보",
      newsCount: company.news.length,
      newsActivityScore,
      interestScore: fit.merchantFitScore,
      partnershipScore: fit.partnershipScore,
      merchantFitScore: fit.merchantFitScore,
      paymentNeed: fit.paymentNeed,
      onlineService: fit.onlineService,
      subscription: fit.subscription,
      b2b: fit.b2b,
      existingPaymentSystem: fit.existingPaymentSystem,
      paymentSystemStatus: fit.paymentSystemStatus,
      fitServices: fit.fitServices,
      discoverySignals: fit.discoverySignals,
      discoveryReason: fit.discoveryReason,
      discoveryQueries: company.queries,
      latestNews: company.news.slice(0, 5).map(n => ({ title: n.title, link: n.link, pubDate: n.pubDate }))
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
    console.log(`${index + 1}. ${company.name} / ${company.industry} / 적합도 ${company.merchantFitScore}`);
    console.log(`   서비스: ${company.fitServices.join(", ") || "추가 확인"}`);
    console.log(`   근거: ${company.discoverySignals.slice(0, 3).join(", ")}`);
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
