const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

const OUTPUT_FILE = path.join(__dirname, "../data/companies.json");
const RSS_BASE_URL = "https://news.google.com/rss/search";
const NEWS_PERIOD = "when:30d";
const MAX_COMPANIES = 150;
const MIN_MENTIONS = 1;
const MIN_SCORE = 30;
const MAX_ITEMS_PER_SOURCE = 30;

const existingStarPlatformPartners = [
  "위비스", "리테일앤인사이트", "에스앤이컴퍼니", "바로팜", "엔라인", "난닝구", "줄로그",
  "제너시스비비큐", "제너시스BBQ", "BBQ", "아트박스", "페이민트", "상하농원", "남양유업",
  "비누커머스", "오뚜기", "에이케이인터렉티브", "여성가족부", "아이돌봄", "먹깨비",
  "대상웰라이프", "SCK컴퍼니", "GS그룹", "GS리테일", "GS Pay"
];

const excludedCompanyNames = [
  ...existingStarPlatformPartners,
  "카카오", "네이버", "메타", "페이스북", "인스타그램", "아마존", "구글", "애플", "마이크로소프트",
  "SK텔레콤", "SKT", "KT", "LG유플러스", "LG U+", "카카오페이", "네이버페이", "토스", "토스페이", "케이뱅크",
  "KB국민은행", "신한은행", "하나은행", "우리은행", "NH농협은행", "IBK기업은행",
  "삼성카드", "현대카드", "신한카드", "KB국민카드", "비자", "마스터카드",
  "KG이니시스", "토스페이먼츠", "NHN KCP", "나이스페이", "다날", "헥토파이낸셜",
  "카페24", "NHN", "쿠팡", "11번가", "G마켓", "옥션", "SSG닷컴", "롯데온"
];

// 기사/영상의 출처명이 기업 후보로 잘못 들어오는 것을 방지한다.
const excludedMediaNames = [
  "연합뉴스", "연합뉴스TV", "KBS", "KBS News", "MBC", "SBS", "JTBC", "YTN", "MBN", "TV조선", "채널A",
  "조선일보", "중앙일보", "동아일보", "한국경제", "매일경제", "서울경제", "머니투데이", "파이낸셜뉴스",
  "전자신문", "뉴스1", "뉴시스", "이데일리", "아시아경제", "헤럴드경제", "한국일보", "경향신문",
  "디지털타임스", "아이뉴스24", "블로터", "비즈워치", "뉴스핌", "프레시안", "오마이뉴스", "지디넷코리아",
  "ZDNET Korea", "ZDNet", "코리아헤럴드", "코리아타임스", "연합뉴스TV", "서울신문", "국민일보", "세계일보"
];

const excludedContentNames = [
  "일머니", "덤핑장인", "신사임당", "세바시", "EO", "머니그라운드", "마케팅", "창업", "뉴스", "News", "TV",
  "Official", "채널", "브랜드뉴스", "쇼핑뉴스"
];

// 기업명이 아닌 일반 명사/문장 조각.
const genericCompanyNames = [
  "AI", "APP", "월드", "가을", "전 세계", "이번 추석", "주문 하면", "오늘 주문한 치즈케이크",
  "요즘 공동구매", "무자본 창업할 방법", "14일동안 식품공장 없", "패션 이커머스", "치킨 3사", "추석 장보기",
  "식약처", "금감원", "국토부", "경상북도", "직접판매 대형 행사", "제천에서 난 농산물", "고농축 니코틴 원액",
  "N년차 도매브랜드", "자사몰", "공식몰", "브랜드몰", "온라인몰", "쇼핑몰", "오픈마켓", "식자재", "상품", "제품",
  "주문", "판매", "구매", "예약", "예매", "구독", "멤버십", "사업자몰", "폐쇄몰", "패션 이커머스", "치킨 3사"
];

const genericLeadWords = new Set([
  "오늘", "이번", "요즘", "매일", "직접판매", "병행수입", "전", "성공적인", "무자본", "제천에서", "고농축",
  "여성", "남성", "신규", "온라인", "모바일", "패션", "식품", "치킨", "도매", "식자재", "쇼핑몰", "오픈마켓",
  "온라인몰", "자사몰", "공식몰", "주문", "판매", "상품", "제품", "추석", "가을", "봄", "여름", "겨울"
]);

const discoveryQueries = [
  "패션 브랜드 자사몰 신상품", "의류 브랜드 온라인 판매", "패션 쇼핑몰 신상품 출시", "뷰티 브랜드 자사몰 판매",
  "화장품 브랜드 온라인몰", "생활용품 브랜드 온라인 판매", "리빙 브랜드 자사몰", "문구 브랜드 온라인몰",
  "잡화 브랜드 온라인 판매", "D2C 브랜드 온라인 판매", "브랜드 공식몰 신상품", "소비재 브랜드 온라인몰",
  "식품 브랜드 자사몰", "식품기업 온라인몰", "간편식 온라인 판매", "건강식품 온라인 판매", "신선식품 온라인몰",
  "농식품 온라인 판매", "베이커리 온라인 주문", "카페 모바일 주문", "커피 브랜드 모바일 주문",
  "외식 프랜차이즈 앱 주문", "프랜차이즈 온라인 주문", "식음료 브랜드 온라인 주문", "레스토랑 예약 결제", "배달 주문 서비스",
  "B2B 유통 온라인 주문", "사업자 전용 온라인몰", "도매 온라인몰", "기업 대상 상품 주문", "식자재 온라인 주문",
  "병원 대상 상품 주문", "약국 대상 상품 주문", "소매점 상품 주문 플랫폼", "유통업체 온라인 주문",
  "기업용 쇼핑몰 상품 판매", "사업자 상품 주문 서비스", "학원 온라인 수강 신청", "교육 서비스 수강권 판매",
  "온라인 교육 수강권", "문화센터 수강권 온라인", "키즈 서비스 이용권", "돌봄 서비스 이용료",
  "피트니스 회원권 온라인", "헬스장 회원권 판매", "병원 예약 서비스", "건강관리 서비스 예약", "호텔 온라인 예약",
  "숙박 예약 서비스", "여행상품 온라인 판매", "여행사 온라인 예약", "레저 이용권 온라인 판매",
  "관광시설 입장권 온라인", "공연 티켓 온라인 판매", "전시 티켓 온라인 판매", "스포츠 티켓 예매",
  "골프 예약 서비스", "레저 예약 서비스", "식품 정기구독 상품", "생활용품 정기구독", "커피 정기구독",
  "꽃 정기구독", "반려동물 정기구독", "유료 멤버십 상품", "월 구독 상품 판매", "정기배송 서비스",
  "온라인몰 간편결제 도입", "자사몰 결제 편의성 개선", "온라인 주문 결제 도입", "모바일 주문 결제 도입",
  "브랜드몰 결제 개선", "온라인 판매채널 확대", "자사몰 신규 오픈", "온라인몰 신규 오픈", "공식 온라인몰 출시",
  "인스타그램 상품 판매 브랜드", "인스타그램 쇼핑 브랜드", "SNS 라이브커머스 브랜드", "유튜브 쇼핑 브랜드",
  "숏폼 커머스 브랜드", "SNS 신상품 판매", "인플루언서 브랜드 자사몰"
];

const indexedSocialQueries = [
  ...discoveryQueries.slice(0, 36).map(q => `${q} site:instagram.com`),
  ...discoveryQueries.slice(0, 30).map(q => `${q} site:blog.naver.com`),
  ...discoveryQueries.slice(0, 20).map(q => `${q} site:youtube.com`)
];

const transactionKeywords = [
  "상품", "제품", "판매", "주문", "구매", "배송", "쇼핑몰", "온라인몰", "자사몰", "브랜드몰", "공식몰",
  "매장", "가맹점", "프랜차이즈", "예약", "예매", "티켓", "입장권", "이용권", "수강권", "수강료",
  "숙박", "객실", "여행상품", "패키지", "회원권", "멤버십", "구독", "정기구독", "식자재", "도매",
  "소매", "주문앱", "모바일 주문", "배달", "이용료", "결제", "판매채널", "자사몰"
];

const digitalChannelKeywords = [
  "온라인몰", "자사몰", "브랜드몰", "공식몰", "쇼핑몰", "온라인 주문", "주문앱", "모바일 주문", "앱 주문",
  "예약앱", "온라인 예약", "온라인 예매", "모바일 앱", "웹사이트", "플랫폼", "온라인 판매", "라이브커머스",
  "인스타그램", "유튜브", "SNS", "스마트스토어"
];

const merchantNegativeKeywords = [
  "은행", "카드사", "증권사", "보험사", "금융지주", "통신사", "pg", "결제대행", "결제 솔루션",
  "결제 플랫폼", "핀테크", "전자금융", "클라우드", "데이터센터", "반도체", "보안 솔루션", "인증 솔루션"
];

const paymentProviderKeywords = [
  "결제대행", "pg사", "pg 사업", "전자지급결제대행", "결제 솔루션 사업", "결제 인프라 사업",
  "결제 플랫폼 사업", "핀테크 사업", "전자금융업", "간편결제 사업자", "결제사업자", "결제 전문기업"
];

const ownPaymentKeywords = [
  "자체 결제 시스템", "자체 결제시스템", "자체 결제 서비스", "자체 간편결제", "자체 페이", "자체pay",
  "자사 결제 시스템", "자사 결제시스템", "결제 시스템 구축", "결제시스템 구축", "결제 플랫폼 구축",
  "간편결제 구축", "자체 결제 인프라", "자체 결제 솔루션", "페이 출시"
];

const industryRules = [
  { name: "패션/뷰티", keys: ["패션", "의류", "뷰티", "화장품", "잡화"] },
  { name: "식품/식음료", keys: ["식품", "푸드", "식음료", "간편식", "베이커리", "커피", "식자재"] },
  { name: "생활/리테일", keys: ["생활용품", "리빙", "문구", "유통", "리테일"] },
  { name: "B2B 유통", keys: ["B2B", "도매", "사업자 전용", "기업 대상", "약국", "병원", "유통 플랫폼"] },
  { name: "교육/돌봄", keys: ["교육", "학원", "강의", "클래스", "수강", "돌봄"] },
  { name: "여행/숙박", keys: ["여행", "숙박", "호텔", "리조트", "관광"] },
  { name: "레저/티켓", keys: ["레저", "티켓", "공연", "전시", "입장권", "예매", "스포츠"] },
  { name: "헬스케어", keys: ["헬스", "건강", "의료", "피트니스", "병원", "약국"] },
  { name: "서비스/예약", keys: ["예약", "방문", "출장", "청소", "세차", "돌봄", "이용료"] }
];

const excludedKeys = new Set([...excludedCompanyNames, ...excludedMediaNames, ...excludedContentNames].map(normalizeKey));

const sentenceLikePatterns = [
  /^(?:안녕하세요|감사합니다|축하합니다|알아보겠습니다|살펴보겠습니다)/,
  /(?:방법|후기|브리핑|뉴스|채용|면접|공고|추천|비법|꿀팁|가이드|정리|총정리|리뷰|논란|화제)$/, 
  /(?:할|하는|한|했던|없는|있다|있어요|합니다|됩니다|해요|하세요|찾기|찾는|만들기|알기|보기|사는|사기|팔기|판매하기)/,
  /(?:오늘|이번|올해|내년|전 세계|세계가|성공적인|무자본|N년차|\d{4}[./-]\d{1,2})/i,
  /(?:^|\s)(?:그리고|하지만|그래서|왜|어떻게|무엇|누가|언제)(?:\s|$)/,
  /(?:상품|제품|주문|판매|창업|공장|쇼핑몰|패션|식품|치킨|도매|온라인|오픈마켓|사이트|영상|콘텐츠)$/
];

const corporateSuffixPatterns = [
  "전자", "식품", "유통", "리테일", "백화점", "마트", "호텔", "리조트", "농원", "제약", "제과", "베이커리",
  "푸드", "커피", "치킨", "마켓", "몰", "그룹", "산업", "물산", "상사", "건설", "화학", "제조", "테크",
  "랩", "웍스", "스튜디오", "미디어", "시스템즈", "소프트", "모터스", "투어", "여행", "라이프", "웰니스",
  "컴퍼니", "코리아", "월드", "F&B", "에프앤비"
];

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

function normalizeName(name) {
  return cleanText(name)
    .replace(/^[\[【(（<][^\]】)）>]{0,30}[\]】)）>]/, "")
    .replace(/^(?:주식회사|㈜|유한회사)\s*/i, "")
    .replace(/\s*[-|｜].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(name) {
  return normalizeName(name).toLowerCase().replace(/[\s().,&\-·]/g, "");
}

function isExcludedName(name) {
  const key = normalizeKey(name);
  if (!key || excludedKeys.has(key)) return true;
  return [...excludedKeys].some(excluded => key === excluded || key.includes(excluded) || excluded.includes(key));
}

function hasCorporateSuffix(name) {
  const n = normalizeName(name).toLowerCase();
  return corporateSuffixPatterns.some(suffix => n.endsWith(suffix.toLowerCase()));
}

function looksLikeRealCompanyName(name) {
  const n = normalizeName(name);
  if (!n || n.length < 2 || n.length > 35) return false;
  if (isExcludedName(n)) return false;
  if (genericCompanyNames.some(item => normalizeKey(item) === normalizeKey(n))) return false;
  if (/https?:\/\//i.test(n)) return false;
  if (/^[0-9\s.,:/_\-]+$/.test(n)) return false;
  if (sentenceLikePatterns.some(pattern => pattern.test(n))) return false;
  const firstWord = n.split(/\s+/)[0];
  if (genericLeadWords.has(firstWord)) return false;
  if ((n.match(/\s/g) || []).length > 3) return false;
  if (/^(?:전 세계|이번|오늘|요즘|무자본|성공적인|N년차|202\d)/i.test(n)) return false;
  return true;
}

function isStrongCompanyName(name) {
  const n = normalizeName(name);
  if (!looksLikeRealCompanyName(n)) return false;
  if (hasCorporateSuffix(n)) return true;
  if (/^[A-Za-z]{2,8}$/.test(n)) return true; // hy 등 짧은 브랜드명 허용. 단, 미디어/제외목록은 위에서 제거.
  if (/^[가-힣A-Za-z0-9]{2,15}$/.test(n) && !/^(온라인|모바일|식품|패션|치킨|도매|판매|주문|상품|제품|쇼핑|브랜드|사업자|폐쇄몰)$/i.test(n)) return true;
  return false;
}

function extractFromTitle(title) {
  const text = cleanText(title)
    .replace(/^\[[^\]]{1,40}\]\s*/, "")
    .replace(/^【[^】]{1,40}】\s*/, "")
    .trim();

  const candidates = [];

  // 1. 법인명 표기는 가장 높은 신뢰도로 처리한다.
  const corp = text.match(/(?:주식회사|㈜|유한회사)\s*([가-힣A-Za-z0-9&·.()\-]{2,35})/);
  if (corp) candidates.push({ name: corp[1], confidence: 0.99, reason: "법인명 표기" });

  // 2. 제목의 가장 흔한 기업명 패턴: '기업명, 내용'
  const prefix = text.match(/^([가-힣A-Za-z0-9][가-힣A-Za-z0-9&·.()\- ]{1,24}?)[,，:：]\s*/);
  if (prefix && isStrongCompanyName(prefix[1])) {
    candidates.push({ name: prefix[1], confidence: 0.94, reason: "기사 제목 선두 기업명" });
  }

  // 3. '기업명은/는/이/가 ...' 형태
  const subject = text.match(/^([가-힣A-Za-z0-9][가-힣A-Za-z0-9&·.()\- ]{1,22}?)(?:은|는|이|가)\s/);
  if (subject && isStrongCompanyName(subject[1])) {
    candidates.push({ name: subject[1], confidence: 0.90, reason: "기사 제목 주어" });
  }

  // 4. 명시적 기업명 suffix가 있는 경우. 문장 전체를 가져오지 않도록 최대 20자.
  const suffixPattern = new RegExp(`([가-힣A-Za-z0-9&·.-]{2,20}(?:${corporateSuffixPatterns.join("|")}))`, "i");
  const suffixMatch = text.match(suffixPattern);
  if (suffixMatch && isStrongCompanyName(suffixMatch[1])) {
    candidates.push({ name: suffixMatch[1], confidence: 0.88, reason: "기업명 suffix" });
  }

  // 5. 단일 토큰은 무조건 허용하지 않는다. 첫 토큰이 기업명으로 강하게 보일 때만 허용.
  const firstToken = text.split(/[\s,，:：|｜/]+/)[0];
  const hasEditorialWords = /(?:후기|브리핑|뉴스|채용|면접|공고|추천|비법|꿀팁|가이드|정리|총정리|리뷰|논란|화제|창업|방법)/i.test(text);
  if (!hasEditorialWords && firstToken && isStrongCompanyName(firstToken)) {
    candidates.push({ name: firstToken, confidence: 0.80, reason: "기사 제목 선두 토큰" });
  }

  const map = new Map();
  for (const candidate of candidates) {
    const name = normalizeName(candidate.name);
    if (!looksLikeRealCompanyName(name)) continue;
    const key = normalizeKey(name);
    const prev = map.get(key);
    if (!prev || candidate.confidence > prev.confidence) map.set(key, { ...candidate, name });
  }
  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}

function extractCompanyCandidates(title, sourceType = "news", metadata = {}) {
  // Naver Local: 업체명을 직접 제공하므로 가장 높은 신뢰도로 사용.
  if (sourceType === "commerce-local") {
    const raw = normalizeName(metadata.title || title);
    const cleaned = raw
      .replace(/\s*(?:납품|주문|예약|안내|음식점|카페|맛집|매장|영업|메뉴|쇼핑몰|온라인몰).*$/i, "")
      .split(/\s*[·|｜]+\s*/)[0]
      .trim();
    return isStrongCompanyName(cleaned)
      ? [{ name: cleaned, confidence: 0.99, reason: "Naver 지역 업체명" }]
      : [];
  }

  // YouTube 채널명 자체를 기업명으로 쓰지 않는다.
  // 영상 제목에서 기업명이 확인되는 경우에만 후보를 만든다.
  if (sourceType === "social-youtube") {
    return extractFromTitle(title).map(candidate => ({
      ...candidate,
      confidence: Math.min(candidate.confidence, 0.86),
      reason: `YouTube 영상 제목 기반: ${candidate.reason}`
    }));
  }

  return extractFromTitle(title);
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
  const text = [company.name, ...company.queries, ...company.news.map(n => n.title), ...company.news.map(n => n.description || "")].join(" ");
  const transaction = countMatches(text, transactionKeywords);
  const digitalChannel = countMatches(text, digitalChannelKeywords);
  const negative = countMatches(text, merchantNegativeKeywords);
  const provider = countMatches(text, paymentProviderKeywords);
  const ownPayment = countMatches(text, ownPaymentKeywords);

  let score = 0;
  const signals = [];

  if (transaction >= 1) { score += Math.min(40, transaction * 5); signals.push("상품·서비스 거래 신호"); }
  if (transaction >= 3) { score += 10; signals.push("반복적인 판매/주문 신호"); }
  if (digitalChannel >= 1) { score += 20; signals.push("온라인 판매·주문 채널 신호"); }
  if (digitalChannel >= 2) score += 8;
  if (/신규 상품|신상품|신규 서비스|출시|온라인 판매 확대|사업 확대|신규 매장|앱 주문|온라인 주문/i.test(text)) {
    score += 10; signals.push("최근 판매채널/상품 확대 신호");
  }
  if (/구독|정기구독|멤버십|회원권/i.test(text)) { score += 10; signals.push("구독·멤버십 거래 신호"); }
  if (/B2B|도매|사업자 전용|기업 대상|약국|병원|식자재/i.test(text) && /주문|상품|판매|구매|유통/i.test(text)) {
    score += 10; signals.push("B2B 상품 주문/유통 신호");
  }

  score -= Math.min(70, negative * 25);
  score -= Math.min(80, provider * 40);
  if (negative > 0) signals.push("금융·통신·결제사업자 성격 신호");
  if (provider > 0) signals.push("결제사업자/결제 인프라 신호");

  const paymentSystemStatus = ownPayment > 0 ? "existing" : provider > 0 ? "provider" : "unknown";
  if (ownPayment > 0) { score -= 80; signals.push("기존 자체 결제시스템/자체 Pay 확인"); }
  if (negative >= 2 || provider >= 1 || paymentSystemStatus === "existing") score = 0;
  score = Math.max(0, Math.min(100, score));

  const fitServices = [];
  if (score >= 45) fitServices.push("브랜드Pay", "현금영수증", "결제·정산 관리");
  if (/구독|정기구독|멤버십/i.test(text) && score >= 45) fitServices.push("정기결제");
  if (/B2B|법인|사업자 전용/i.test(text) && score >= 45) fitServices.push("법인결제(B2B)");

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
    discoveryReason: score >= 45
      ? `${company.name}은(는) ${signals.slice(0, 3).join(", ")}이 확인되어 KB스타플랫폼 가맹점 후보로 분류했습니다.`
      : "외부 데이터에서 거래 신호가 충분하지 않아 우선순위를 낮췄습니다."
  };
}

function upsertCompany(map, rawName, item) {
  const name = normalizeName(rawName);
  if (!looksLikeRealCompanyName(name)) return;

  const key = normalizeKey(name);
  if (!map.has(key)) {
    map.set(key, {
      name,
      queries: [],
      news: [],
      sources: new Set(),
      sourceTypes: new Set(),
      nameConfidence: 0,
      nameEvidence: "",
      nameEvidenceCount: 0,
      uniqueLinks: new Set(),
      identityReasons: new Set()
    });
  }

  const company = map.get(key);
  company.nameConfidence = Math.max(company.nameConfidence, item.nameConfidence || 0);
  if (item.nameEvidence) company.identityReasons.add(item.nameEvidence);
  if (item.nameConfidence >= 0.8) company.nameEvidenceCount += 1;
  if (item.query && !company.queries.includes(item.query)) company.queries.push(item.query);
  if (item.source) company.sources.add(item.source);
  if (item.sourceType) company.sourceTypes.add(item.sourceType);
  if (item.link) company.uniqueLinks.add(item.link);

  company.news.push({
    title: item.title || `${name} 관련 외부 신호`,
    link: item.link || "",
    pubDate: item.pubDate || "",
    description: item.description || "",
    source: item.source || "",
    sourceType: item.sourceType || "web"
  });
}

async function fetchGoogleNews(query) {
  const url = `${RSS_BASE_URL}?q=${encodeURIComponent(`${query} ${NEWS_PERIOD}`)}&hl=ko&gl=KR&ceid=KR:ko`;
  const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`Google News ${response.status}`);
  const xml = await response.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);
  const raw = parsed?.rss?.channel?.item || [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items.slice(0, MAX_ITEMS_PER_SOURCE).map(item => ({
    title: cleanText(item.title),
    link: item.link || "",
    pubDate: item.pubDate || "",
    description: cleanText(item.description || ""),
    source: "Google News",
    sourceType: "news"
  })).filter(item => item.title);
}

let naverStatus = process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET ? "configured" : "not-configured";
let naverAuthFailed = false;

// NAVER API HUB는 기존 openapi.naver.com/v1/search/*가 아니라
// https://naverapihub.apigw.ntruss.com/search/v1/* 엔드포인트를 사용한다.
// API HUB의 인증 헤더도 X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY를 사용한다.
const NAVER_API_HUB_BASE = "https://naverapihub.apigw.ntruss.com/search/v1";

const NAVER_API_CONFIG = {
  news: { path: "news", display: 50, sort: "date" },
  blog: { path: "blog", display: 50, sort: "date" },
  web: { path: "webkr", display: 50, sort: null },
  local: { path: "local", display: 5, sort: "comment" },
  cafe: { path: "cafearticle", display: 50, sort: "date" }
};

function stripHtml(value) {
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

async function fetchNaverHub(query, type) {
  if (naverAuthFailed) return [];

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    naverStatus = "not-configured";
    return [];
  }

  const config = NAVER_API_CONFIG[type];
  if (!config) return [];

  const params = new URLSearchParams({
    query,
    display: String(config.display),
    start: "1",
    format: "json"
  });

  if (config.sort) params.set("sort", config.sort);

  const url = `${NAVER_API_HUB_BASE}/${config.path}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-NCP-APIGW-API-KEY-ID": clientId,
      "X-NCP-APIGW-API-KEY": clientSecret,
      "Accept": "application/json",
      "User-Agent": "KB-StarPlatform-MerchantDiscovery/7.0"
    }
  });

  const bodyText = await response.text();
  let data = {};
  try {
    data = JSON.parse(bodyText);
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    if (response.status === 401) {
      naverAuthFailed = true;
      naverStatus = "auth-failed-401";
      const message = data?.error?.message || data?.errorMessage || bodyText.slice(0, 200);
      console.error(`Naver API HUB 인증 실패(401): ${message}`);
      console.error("NAVER_CLIENT_ID/SECRET, NAVER API HUB Application의 API 권한을 확인하세요.");
      console.error("기존 openapi.naver.com 키가 아니라 NAVER Cloud Platform > NAVER API HUB에서 발급한 키가 필요합니다.");
    } else if (response.status === 429) {
      naverStatus = "rate-limited-429";
      console.error(`Naver API HUB 호출 한도 초과(429): ${type} / ${query}`);
    } else {
      naverStatus = `error-${response.status}`;
      console.error(`Naver API HUB ${type} 오류 ${response.status}: ${query}`);
      if (data?.errorMessage) console.error(`  ${data.errorMessage}`);
      if (data?.error?.message) console.error(`  ${data.error.message}`);
    }
    return [];
  }

  naverStatus = "active";
  return Array.isArray(data.items) ? data.items : [];
}

function normalizeNaverHubItem(item, type) {
  if (type === "local") {
    return {
      title: stripHtml(item.title),
      link: item.link || "",
      pubDate: "",
      description: stripHtml([item.category, item.description, item.address, item.roadAddress].filter(Boolean).join(" ")),
      source: "Naver Local",
      sourceType: "commerce-local",
      category: stripHtml(item.category || ""),
      address: stripHtml(item.address || ""),
      roadAddress: stripHtml(item.roadAddress || "")
    };
  }

  if (type === "blog") {
    return {
      title: stripHtml(item.title),
      link: item.link || "",
      pubDate: item.postdate || "",
      description: stripHtml(item.description || ""),
      source: `Naver Blog / ${stripHtml(item.bloggername || "")}`,
      sourceType: "social-naver-blog"
    };
  }

  if (type === "cafe") {
    return {
      title: stripHtml(item.title),
      link: item.link || "",
      pubDate: "",
      description: stripHtml(item.description || ""),
      source: `Naver Cafe / ${stripHtml(item.cafename || "")}`,
      sourceType: "social-naver-cafe"
    };
  }

  if (type === "web") {
    return {
      title: stripHtml(item.title),
      link: item.link || "",
      pubDate: "",
      description: stripHtml(item.description || ""),
      source: "Naver Web",
      sourceType: "web-naver"
    };
  }

  return {
    title: stripHtml(item.title),
    link: item.link || item.originallink || "",
    pubDate: item.pubDate || "",
    description: stripHtml(item.description || ""),
    source: "Naver News",
    sourceType: "news-naver"
  };
}

let youtubeStatus = process.env.YOUTUBE_API_KEY ? "configured" : "not-configured";
let youtubeAuthFailed = false;

async function fetchYouTube(query) {
  if (youtubeAuthFailed) return [];
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=25&order=date&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      youtubeAuthFailed = true;
      youtubeStatus = `auth-failed-${response.status}`;
      console.error(`YouTube API 인증/권한 오류(${response.status}): YOUTUBE_API_KEY 또는 YouTube Data API 활성화를 확인하세요. 이후 요청은 중단합니다.`);
    } else {
      youtubeStatus = `error-${response.status}`;
      console.error(`YouTube 오류 ${response.status}: ${query}`);
    }
    return [];
  }

  youtubeStatus = "active";
  const data = await response.json();
  return (data.items || []).map(item => ({
    title: cleanText(item.snippet?.title),
    link: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : "",
    pubDate: item.snippet?.publishedAt || "",
    description: cleanText(item.snippet?.description || ""),
    source: `YouTube / ${cleanText(item.snippet?.channelTitle || "channel")}`,
    sourceType: "social-youtube",
    channelTitle: cleanText(item.snippet?.channelTitle || "")
  }));
}

function dedupeNews(news) {
  const map = new Map();
  for (const item of news) {
    const key = `${item.link}|${item.title}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function makeId(name) {
  return normalizeName(name).toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runQueryBatch(companyMap, queries, fetcher) {
  for (const query of queries) {
    try {
      const items = await fetcher(query);
      for (const item of items) {
        const candidates = extractCompanyCandidates(item.title, item.sourceType || "news", item);
        for (const candidate of candidates) {
          upsertCompany(companyMap, candidate.name, {
            ...item,
            query,
            nameConfidence: candidate.confidence,
            nameEvidence: candidate.reason
          });
        }
      }
      await sleep(120);
    } catch (error) {
      console.error(`검색 실패: ${query} / ${error.message}`);
    }
  }
}

async function runNaverSearch(companyMap) {
  if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
    naverStatus = "not-configured";
    console.log("Naver API HUB Secret 미설정 → Naver 검색은 건너뜀");
    return;
  }

  // API HUB에서 실제 기업/사업자 후보를 찾기 위한 검색어.
  // Local은 실제 업체명, News/Web은 기업명과 사업 활동, Blog/Cafe는 판매 활동의 보조 증거로 사용한다.
  const naverQueries = [
    "패션 브랜드 자사몰",
    "의류 브랜드 온라인몰",
    "뷰티 브랜드 온라인몰",
    "화장품 브랜드 공식몰",
    "생활용품 브랜드 온라인몰",
    "리빙 브랜드 자사몰",
    "식품 브랜드 온라인몰",
    "식품기업 자사몰",
    "건강식품 온라인몰",
    "신선식품 온라인몰",
    "베이커리 온라인 주문",
    "카페 모바일 주문",
    "외식 프랜차이즈 주문앱",
    "프랜차이즈 온라인 주문",
    "온라인 쇼핑몰",
    "브랜드 공식몰",
    "사업자 전용 온라인몰",
    "B2B 온라인몰",
    "도매 온라인몰",
    "식자재 온라인 주문",
    "기업용 상품 주문",
    "온라인 교육 수강권",
    "학원 수강권 온라인",
    "피트니스 회원권",
    "호텔 온라인 예약",
    "숙박 예약",
    "여행상품 온라인 판매",
    "레저 이용권 온라인 판매",
    "공연 티켓 온라인 판매",
    "정기구독 상품",
    "정기배송 서비스",
    "온라인 멤버십 상품",
    "온라인 판매채널 확대",
    "자사몰 신규 오픈",
    "온라인몰 신규 오픈",
    "모바일 주문 서비스",
    "온라인 예약 서비스"
  ];

  // Local은 5개까지만 반환되므로 사업자/업종 검색어를 다양하게 사용한다.
  // News/Web/Blog/Cafe는 동일 검색어를 재사용해 서로 다른 데이터 신호를 결합한다.
  const searchTypes = ["news", "web", "blog", "cafe", "local"];

  for (const query of naverQueries) {
    if (naverAuthFailed) break;

    for (const type of searchTypes) {
      if (naverAuthFailed) break;

      try {
        const rawItems = await fetchNaverHub(query, type);
        const items = rawItems.map(item => normalizeNaverHubItem(item, type));

        for (const item of items) {
          const candidates = extractCompanyCandidates(item.title, item.sourceType, item);

          for (const candidate of candidates) {
            upsertCompany(companyMap, candidate.name, {
              ...item,
              query,
              nameConfidence: candidate.confidence,
              nameEvidence: candidate.reason
            });
          }
        }

        await sleep(80);
      } catch (error) {
        console.error(`Naver API HUB ${type} 예외: ${query} / ${error.message}`);
      }
    }
  }
}

async function runYouTube(companyMap) {
  if (!process.env.YOUTUBE_API_KEY) {
    youtubeStatus = "not-configured";
    console.log("YouTube API Key 미설정 → YouTube 직접 검색은 건너뜀");
    return;
  }
  await runQueryBatch(companyMap, discoveryQueries.slice(0, 40), fetchYouTube);
}

function isCandidateIdentityReliable(company) {
  const trustedCommerce = [...company.sourceTypes].some(type => ["commerce-local"].includes(type));
  const explicitIdentity = company.nameEvidenceCount >= 1 && [...company.identityReasons].some(reason =>
    ["법인명 표기", "기사 제목 선두 기업명", "기사 제목 주어", "기업명 suffix", "Naver 지역 업체명", "Naver 쇼핑 브랜드", "Naver 쇼핑 제조사"].includes(reason)
  );
  const corroborated = company.nameEvidenceCount >= 2 || company.uniqueLinks.size >= 2 || company.sourceTypes.size >= 2;

  // 상거래 API가 있으면 업체/브랜드명이 직접 확인된 것으로 본다.
  if (trustedCommerce) return true;
  // 법인명/기업명 패턴이 한 번이라도 명확하게 확인된 경우 허용.
  if (explicitIdentity && company.nameConfidence >= 0.86) return true;
  // 짧은 브랜드명은 여러 독립 자료에서 반복될 때만 허용한다.
  if (corroborated && company.nameConfidence >= 0.80 && isStrongCompanyName(company.name)) return true;
  return false;
}

async function main() {
  console.log("==============================================");
  console.log(" KB스타플랫폼 신규 가맹점 후보 발굴 v7");
  console.log(" NAVER API HUB + Company Identity Resolver + Multi-channel Discovery");
  console.log("==============================================");

  const companyMap = new Map();

  console.log(`1) Google News 일반 검색: ${discoveryQueries.length}개 쿼리`);
  await runQueryBatch(companyMap, discoveryQueries, fetchGoogleNews);

  console.log(`2) Google News 색인 SNS/블로그 검색: ${indexedSocialQueries.length}개 쿼리`);
  await runQueryBatch(companyMap, indexedSocialQueries, fetchGoogleNews);

  console.log("3) Naver API HUB: News + Web + Blog + Cafe + Local");
  await runNaverSearch(companyMap);

  console.log("4) YouTube Data API");
  await runYouTube(companyMap);

  const candidates = [];

  for (const company of companyMap.values()) {
    company.news = dedupeNews(company.news);
    if (company.news.length < MIN_MENTIONS) continue;
    if (!isCandidateIdentityReliable(company)) continue;

    const fit = analyzeMerchantFit(company);
    if (fit.merchantFitScore < MIN_SCORE) continue;
    if (fit.paymentSystemStatus === "existing" || fit.paymentSystemStatus === "provider") continue;

    const allText = [company.name, ...company.queries, ...company.news.map(n => n.title), ...company.news.map(n => n.description)].join(" ");
    company.news.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    const sourceTypes = [...company.sourceTypes];
    const sourceNames = [...company.sources];
    const newsActivityScore = Math.min(100, 20 + company.news.length * 5);
    const socialSignal = sourceTypes.some(type => ["social", "social-web", "social-youtube", "social-naver-blog", "social-naver-cafe"].includes(type));
    const commerceSignal = sourceTypes.some(type => ["commerce", "commerce-local", "commerce-shop"].includes(type));

    candidates.push({
      id: makeId(company.name),
      name: company.name,
      nameConfidence: Number(company.nameConfidence.toFixed(2)),
      nameEvidence: [...company.identityReasons].join(", "),
      nameEvidenceCount: company.nameEvidenceCount,
      industry: inferIndustry(allText),
      description: "상품·서비스 거래 및 판매채널 신호를 여러 외부 채널에서 발견한 신규 가맹점 후보",
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
      sourceTypes,
      sourceNames,
      socialSignal,
      commerceSignal,
      aiValidationStatus: "pending",
      latestNews: company.news.slice(0, 8).map(n => ({
        title: n.title,
        link: n.link,
        pubDate: n.pubDate,
        source: n.source,
        sourceType: n.sourceType
      }))
    });
  }

  candidates.sort((a, b) => {
    const scoreA = a.merchantFitScore + (a.commerceSignal ? 8 : 0) + (a.socialSignal ? 3 : 0) + Math.min(8, a.sourceTypes.length * 2) + Math.min(6, a.nameEvidenceCount);
    const scoreB = b.merchantFitScore + (b.commerceSignal ? 8 : 0) + (b.socialSignal ? 3 : 0) + Math.min(8, b.sourceTypes.length * 2) + Math.min(6, b.nameEvidenceCount);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return (b.newsCount || 0) - (a.newsCount || 0);
  });

  const finalCompanies = candidates.slice(0, MAX_COMPANIES);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalCompanies, null, 2), "utf8");

  console.log(`전체 후보(기업명 검증 통과): ${candidates.length}개`);
  console.log(`최종 저장: ${finalCompanies.length}개`);
  console.log(`Naver API 상태: ${naverStatus}`);
  console.log(`YouTube API 상태: ${youtubeStatus}`);
  console.log("");

  finalCompanies.slice(0, 30).forEach((company, index) => {
    console.log(`${index + 1}. ${company.name} / ${company.industry} / ${company.merchantFitScore}`);
    console.log(`   기업명 근거: ${company.nameEvidence || "-"}`);
    console.log(`   채널: ${company.sourceTypes.join(", ") || "news"}`);
    console.log(`   서비스: ${company.fitServices.join(", ") || "추가 확인"}`);
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
