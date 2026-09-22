const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

// ==================================================
// 기본 설정
// ==================================================

const OUTPUT_FILE = path.join(
    __dirname,
    "../data/companies.json"
);

const GOOGLE_NEWS_URL =
    "https://news.google.com/rss/search";

// 최근 7일 뉴스 기준
const NEWS_PERIOD = "when:7d";

// 한 검색어당 가져올 최대 뉴스 수
const MAX_NEWS_PER_QUERY = 50;

// 최종적으로 저장할 기업 수
const MAX_COMPANIES = 50;

// 기업 후보로 인정하기 위한 최소 뉴스 수
const MIN_MENTIONS = 2;

// 검색어
// --------------------------------------------------
// "기업명을 알고 검색"하는 것이 아니라
// "기업을 발견하기 위한 키워드"임
// ==================================================

const discoveryQueries = [
    "AI 금융 스타트업",
    "AI 핀테크 투자",
    "핀테크 신규 서비스",
    "금융 플랫폼 신규 사업",
    "AI 금융 플랫폼",
    "핀테크 파트너십",
    "핀테크 업무협약",
    "금융 스타트업 투자 유치"
];

// ==================================================
// 기업명이 아닌 것으로 판단할 단어
// ==================================================

const INVALID_CANDIDATES = new Set([
    "정부",
    "국회",
    "금융위원회",
    "금융감독원",
    "한국은행",
    "기획재정부",
    "중소벤처기업부",
    "산업통상자원부",
    "과학기술정보통신부",
    "대통령실",
    "대통령",
    "국무총리",
    "서울시",
    "경기도",
    "부산시",
    "한국",
    "미국",
    "중국",
    "일본",
    "유럽",
    "글로벌",
    "시장",
    "업계",
    "정부기관",
    "금융권",
    "은행권",
    "스타트업",
    "기업",
    "업체",
    "회사",
    "관련업계",
    "금융당국",
    "당국"
]);

// ==================================================
// 산업 분류
// ==================================================

function inferIndustry(query) {

    const q = query.toLowerCase();

    if (
        q.includes("핀테크") ||
        q.includes("금융") ||
        q.includes("은행") ||
        q.includes("결제")
    ) {
        return "핀테크";
    }

    if (
        q.includes("ai") ||
        q.includes("인공지능")
    ) {
        return "AI";
    }

    if (
        q.includes("플랫폼")
    ) {
        return "플랫폼";
    }

    return "기타";
}

// ==================================================
// Google News RSS URL 생성
// ==================================================

function createGoogleNewsUrl(query) {

    const searchQuery =
        `${query} ${NEWS_PERIOD}`;

    const params = new URLSearchParams({
        q: searchQuery,
        hl: "ko",
        gl: "KR",
        ceid: "KR:ko"
    });

    return `${GOOGLE_NEWS_URL}?${params.toString()}`;
}

// ==================================================
// RSS 가져오기
// ==================================================

async function fetchNews(query) {

    const url =
        createGoogleNewsUrl(query);

    console.log("");
    console.log("========================================");
    console.log(`뉴스 검색: ${query}`);
    console.log("========================================");
    console.log(url);

    try {

        const response =
            await fetch(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 AI-Partnership-Discovery/1.0"
                }
            });

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const xml =
            await response.text();

        const parser =
            new XMLParser({
                ignoreAttributes: false
            });

        const parsed =
            parser.parse(xml);

        const items =
            parsed?.rss?.channel?.item;

        if (!items) {

            console.log(
                "검색 결과가 없습니다."
            );

            return [];

        }

        const normalized =
            Array.isArray(items)
                ? items
                : [items];

        return normalized
            .slice(0, MAX_NEWS_PER_QUERY)
            .map(item => ({
                title: cleanText(item.title),
                link: item.link || "",
                pubDate: item.pubDate || "",
                source:
                    typeof item.source === "object"
                        ? item.source["#text"]
                        : item.source || "",
                query
            }))
            .filter(news => news.title);

    } catch (error) {

        console.error(
            `뉴스 수집 실패: ${query}`
        );

        console.error(
            error.message
        );

        return [];
    }
}

// ==================================================
// 텍스트 정리
// ==================================================

function cleanText(value) {

    if (!value) {
        return "";
    }

    return String(value)
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// ==================================================
// 뉴스 제목에서 기업 후보 추출
//
// 예:
// "토스, AI 금융 서비스 출시"
//       ↓
// "토스"
//
// "네이버가 AI 서비스를 출시"
//       ↓
// "네이버"
//
// "카카오와 KB국민은행이 협력"
//       ↓
// "카카오"
//
// 완벽한 NER가 아니라 PoC용 후보 추출 로직
// ==================================================

function extractCompanyCandidate(title) {

    if (!title) {
        return null;
    }

    let text = title
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\([^)]*\)/g, "")
        .trim();

    // Google News 제목에 붙는 출처 제거
    // 예:
    // "A사, 신규 서비스 출시 - 매일경제"
    text = text
        .replace(/\s+-\s+[^-]+$/, "")
        .trim();

    // ------------------------------------------------
    // 1. 제목 처음에 나오는 기업명
    //
    // A사, ...
    // A사 "..."
    // A사, B사 ...
    // ------------------------------------------------

    let match =
        text.match(
            /^(.{2,30}?)(?:,|，|:|：|·|\s-\s)/
        );

    if (match) {

        const candidate =
            normalizeCompanyName(
                match[1]
            );

        if (isValidCandidate(candidate)) {
            return candidate;
        }
    }

    // ------------------------------------------------
    // 2. "~가", "~이", "~은", "~는" 형태
    //
    // 네이버가 AI 서비스를 출시
    // 카카오가 신규 사업에 진출
    // ------------------------------------------------

    match =
        text.match(
            /^(.{2,30}?)(?:가|이|은|는)\s/
        );

    if (match) {

        const candidate =
            normalizeCompanyName(
                match[1]
            );

        if (isValidCandidate(candidate)) {
            return candidate;
        }
    }

    // ------------------------------------------------
    // 3. "기업명과", "기업명와"
    // ------------------------------------------------

    match =
        text.match(
            /^(.{2,30}?)(?:과|와)\s/
        );

    if (match) {

        const candidate =
            normalizeCompanyName(
                match[1]
            );

        if (isValidCandidate(candidate)) {
            return candidate;
        }
    }

    // ------------------------------------------------
    // 4. 회사/기업/그룹 형태
    // ------------------------------------------------

    match =
        text.match(
            /([가-힣A-Za-z0-9·&.\-]{2,30}(?:그룹|홀딩스|홀딩|테크|랩스|랩|벤처스|벤처|코리아|파트너스|컴퍼니|기업|은행|증권|카드|캐피탈|생명|손해보험))/
        );

    if (match) {

        const candidate =
            normalizeCompanyName(
                match[1]
            );

        if (isValidCandidate(candidate)) {
            return candidate;
        }
    }

    return null;
}

// ==================================================
// 기업명 정규화
// ==================================================

function normalizeCompanyName(name) {

    if (!name) {
        return null;
    }

    let result =
        String(name)
            .replace(/^['"“”‘’]+/, "")
            .replace(/['"“”‘’]+$/, "")
            .replace(/\s+/g, " ")
            .trim();

    // 앞쪽 불필요한 표현 제거
    result =
        result.replace(
            /^(주식회사|㈜)\s*/,
            ""
        );

    // 너무 긴 경우 기업명이 아닐 가능성이 높음
    if (result.length > 30) {
        return null;
    }

    return result;
}

// ==================================================
// 후보 기업 검증
// ==================================================

function isValidCandidate(name) {

    if (!name) {
        return false;
    }

    if (name.length < 2) {
        return false;
    }

    if (name.length > 30) {
        return false;
    }

    if (
        INVALID_CANDIDATES.has(name)
    ) {
        return false;
    }

    // 문장처럼 긴 후보 제외
    if (
        /[.!?。！？]/.test(name)
    ) {
        return false;
    }

    // 숫자만 있는 경우 제외
    if (
        /^[0-9]+$/.test(name)
    ) {
        return false;
    }

    // 일반적인 기사 표현 제외
    const invalidPatterns = [
        /^최근/,
        /^이번/,
        /^관련/,
        /^국내/,
        /^글로벌/,
        /^업계/,
        /^시장/,
        /^금융권/,
        /^은행권/,
        /^스타트업계/,
        /^전문가/
    ];

    if (
        invalidPatterns.some(
            pattern => pattern.test(name)
        )
    ) {
        return false;
    }

    return true;
}

// ==================================================
// 기업 후보 집계
// ==================================================

function aggregateCandidates(newsList) {

    const candidates =
        new Map();

    for (const news of newsList) {

        const company =
            extractCompanyCandidate(
                news.title
            );

        if (!company) {
            continue;
        }

        if (!candidates.has(company)) {

            candidates.set(
                company,
                {
                    name: company,
                    mentions: 0,
                    queries: new Set(),
                    industries: new Set(),
                    news: []
                }
            );

        }

        const candidate =
            candidates.get(company);

        candidate.mentions++;

        candidate.queries.add(
            news.query
        );

        candidate.industries.add(
            inferIndustry(news.query)
        );

        candidate.news.push(news);
    }

    return candidates;
}

// ==================================================
// 중복 뉴스 제거
// ==================================================

function deduplicateNews(newsList) {

    const map = new Map();

    for (const news of newsList) {

        const key =
            news.link ||
            `${news.title}_${news.pubDate}`;

        if (!map.has(key)) {
            map.set(key, news);
        }
    }

    return [...map.values()];
}

// ==================================================
// 최근 뉴스 여부
// ==================================================

function getRecentNewsCount(newsList) {

    const now =
        Date.now();

    const sevenDays =
        7 * 24 * 60 * 60 * 1000;

    return newsList.filter(news => {

        const time =
            new Date(news.pubDate).getTime();

        if (Number.isNaN(time)) {
            return false;
        }

        return (
            now - time <= sevenDays
        );

    }).length;
}

// ==================================================
// 활동 지수 계산
// ==================================================

function calculateActivityScore(
    newsCount,
    recentNewsCount,
    queryCount
) {

    let score = 0;

    // 뉴스 활동
    score += Math.min(
        newsCount * 5,
        50
    );

    // 최근 뉴스
    score += Math.min(
        recentNewsCount * 5,
        30
    );

    // 여러 검색어에서 발견
    score += Math.min(
        queryCount * 5,
        20
    );

    return Math.min(
        Math.round(score),
        100
    );
}

// ==================================================
// 후보 점수 계산
//
// 기존 화면의 interestScore와 호환
// ==================================================

function calculateInterestScore(
    activityScore,
    queryCount,
    recentNewsCount
) {

    let score =
        activityScore;

    // 여러 발굴 키워드에서 반복 발견된 기업
    if (queryCount >= 3) {
        score += 5;
    }

    if (queryCount >= 5) {
        score += 5;
    }

    // 최근 뉴스가 많으면 가점
    if (recentNewsCount >= 5) {
        score += 5;
    }

    return Math.min(
        Math.round(score),
        100
    );
}

// ==================================================
// 기업 설명 생성
// ==================================================

function createDescription(
    candidate,
    industry
) {

    const signals =
        [...candidate.queries];

    if (!signals.length) {
        return `${industry} 분야 외부 뉴스에서 발견된 기업`;
    }

    return `${industry} 관련 외부 뉴스에서 발견된 기업. ` +
        `주요 발견 키워드: ${signals.slice(0, 3).join(", ")}`;
}

// ==================================================
// ID 생성
// ==================================================

function createCompanyId(name) {

    return name
        .toLowerCase()
        .replace(/[^a-z0-9가-힣]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

// ==================================================
// companies.json 생성
// ==================================================

function buildCompanies(
    candidates
) {

    const result = [];

    for (const candidate of candidates) {

        // 최소 뉴스 수 조건
        if (
            candidate.mentions <
            MIN_MENTIONS
        ) {
            continue;
        }

        const news =
            deduplicateNews(
                candidate.news
            );

        const recentNewsCount =
            getRecentNewsCount(news);

        const queryCount =
            candidate.queries.size;

        const activityScore =
            calculateActivityScore(
                news.length,
                recentNewsCount,
                queryCount
            );

        const interestScore =
            calculateInterestScore(
                activityScore,
                queryCount,
                recentNewsCount
            );

        // 여러 산업이 섞여 있으면 가장 많이 발견된 산업 사용
        const industry =
            [...candidate.industries][0] ||
            "기타";

        result.push({

            id: createCompanyId(
                candidate.name
            ),

            name:
                candidate.name,

            industry,

            description:
                createDescription(
                    candidate,
                    industry
                ),

            newsCount:
                news.length,

            newsActivityScore:
                activityScore,

            interestScore,

            discoverySignals:
                [...candidate.queries],

            discoveryReason: {
                mentionCount:
                    candidate.mentions,

                queryCount,

                recentNewsCount
            },

            latestNews:
                news
                    .sort(
                        (a, b) =>
                            new Date(b.pubDate) -
                            new Date(a.pubDate)
                    )
                    .slice(0, 10)
                    .map(item => ({
                        title:
                            item.title,

                        link:
                            item.link,

                        pubDate:
                            item.pubDate,

                        source:
                            item.source
                    }))
        });
    }

    // 발굴 점수순
    result.sort(
        (a, b) =>
            b.interestScore -
            a.interestScore
    );

    return result.slice(
        0,
        MAX_COMPANIES
    );
}

// ==================================================
// JSON 저장
// ==================================================

function saveCompanies(
    companies
) {

    const directory =
        path.dirname(
            OUTPUT_FILE
        );

    if (
        !fs.existsSync(directory)
    ) {
        fs.mkdirSync(
            directory,
            {
                recursive: true
            }
        );
    }

    fs.writeFileSync(

        OUTPUT_FILE,

        JSON.stringify(
            companies,
            null,
            2
        ),

        "utf8"
    );

    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        `companies.json 저장 완료`
    );
    console.log(
        `파일: ${OUTPUT_FILE}`
    );
    console.log(
        `기업 수: ${companies.length}`
    );
    console.log(
        "========================================"
    );
}

// ==================================================
// 메인
// ==================================================

async function main() {

    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "AI 기업 후보 자동 발굴"
    );
    console.log(
        "Google News RSS 기반"
    );
    console.log(
        "========================================"
    );

    console.log("");
    console.log(
        `검색어: ${discoveryQueries.length}개`
    );

    console.log(
        `검색 기간: 최근 ${NEWS_PERIOD}`
    );

    // ----------------------------------------------
    // 1. 검색어별 뉴스 수집
    // ----------------------------------------------

    let allNews = [];

    for (
        const query of discoveryQueries
    ) {

        const news =
            await fetchNews(
                query
            );

        console.log(
            `수집 뉴스: ${news.length}건`
        );

        allNews.push(
            ...news
        );

        // Google News 요청 간 짧은 대기
        await sleep(500);
    }

    console.log("");
    console.log(
        `전체 수집 뉴스: ${allNews.length}건`
    );

    // ----------------------------------------------
    // 2. 뉴스 중복 제거
    // ----------------------------------------------

    allNews =
        deduplicateNews(
            allNews
        );

    console.log(
        `중복 제거 후 뉴스: ${allNews.length}건`
    );

    // ----------------------------------------------
    // 3. 기업 후보 추출
    // ----------------------------------------------

    const candidateMap =
        aggregateCandidates(
            allNews
        );

    console.log(
        `발견된 기업 후보: ${candidateMap.size}개`
    );

    // ----------------------------------------------
    // 4. companies.json 생성
    // ----------------------------------------------

    const candidates =
        [...candidateMap.values()]
            .sort(
                (a, b) =>
                    b.mentions -
                    a.mentions
            );

    const companies =
        buildCompanies(
            candidates
        );

    // ----------------------------------------------
    // 5. 결과 출력
    // ----------------------------------------------

    console.log("");
    console.log(
        "===== 발굴 기업 ====="
    );

    companies.forEach(
        (company, index) => {

            console.log(
                `${String(index + 1).padStart(2, "0")}. ` +
                `${company.name} ` +
                `| 뉴스 ${company.newsCount}건 ` +
                `| 활동 ${company.newsActivityScore} ` +
                `| 발굴점수 ${company.interestScore}`
            );

        }
    );

    // ----------------------------------------------
    // 6. 저장
    // ----------------------------------------------

    saveCompanies(
        companies
    );
}

// ==================================================
// sleep
// ==================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

// ==================================================
// 실행
// ==================================================

main().catch(error => {

    console.error("");
    console.error(
        "기업 발굴 중 오류가 발생했습니다."
    );

    console.error(
        error
    );

    process.exit(1);
});