const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

const ROOT = path.join(__dirname, "..");
const SEED_FILE = path.join(ROOT, "data", "company-seeds.json");
const OUTPUT_FILE = path.join(ROOT, "data", "companies.json");

const parser = new XMLParser({
  ignoreAttributes: false
});

async function fetchNews(companyName) {
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(companyName) +
    "&hl=ko&gl=KR&ceid=KR:ko";

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `${companyName} 뉴스 요청 실패: HTTP ${response.status}`
    );
  }

  const xml = await response.text();

  const parsed = parser.parse(xml);

  const items = parsed?.rss?.channel?.item || [];

  const newsItems = Array.isArray(items) ? items : [items];

  return newsItems
    .filter(Boolean)
    .slice(0, 20)
    .map(item => ({
      title: cleanText(item.title || ""),
      link: item.link || "",
      publishedAt: item.pubDate || ""
    }));
}

function cleanText(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function calculateActivityScore(newsCount) {
  if (newsCount >= 20) return 100;
  if (newsCount >= 15) return 90;
  if (newsCount >= 10) return 80;
  if (newsCount >= 7) return 70;
  if (newsCount >= 5) return 60;
  if (newsCount >= 3) return 50;
  if (newsCount >= 1) return 40;

  return 20;
}

function calculateGrowthScore(activityScore) {
  return Math.min(
    99,
    Math.max(
      10,
      Math.round(activityScore * 0.85)
    )
  );
}

function calculateInterestScore(activityScore) {
  return Math.min(
    99,
    Math.max(
      10,
      Math.round(activityScore * 0.9 + 10)
    )
  );
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

async function crawlCompany(company, index) {
  console.log(
    `[${index}] ${company.name} 데이터 수집 시작`
  );

  try {
    const news = await fetchNews(company.name);

    const activityScore =
      calculateActivityScore(news.length);

    const growth =
      calculateGrowthScore(activityScore);

    const interestScore =
      calculateInterestScore(activityScore);

    const latestNews =
      news.slice(0, 5);

    console.log(
      `  뉴스 ${news.length}건 / 관심도 ${interestScore}`
    );

    return {
      id: index,
      name: company.name,
      industry: company.industry,

      growth,
      searchGrowth: activityScore,
      snsGrowth: Math.round(
        activityScore * 0.8
      ),

      interestScore,

      status:
        interestScore >= 80
          ? "고관심 후보"
          : "관심 후보",

      customersShort:
        company.customers,

      customers:
        company.customers +
        " 고객군을 중심으로 외부 활동량을 확인하고 있습니다.",

      description:
        "외부 뉴스 및 온라인 활동 데이터를 기반으로 분석 중인 제휴 후보 업체입니다.",

      products:
        company.products,

      updatedAt:
        formatDate(new Date()),

      newsCount:
        news.length,

      newsActivityScore:
        activityScore,

      latestNews,

      searchHistory: [
        {
          month: "현재",
          value: activityScore
        }
      ],

      snsHistory: [
        {
          month: "현재",
          value: Math.round(
            activityScore * 0.8
          )
        }
      ]
    };

  } catch (error) {

    console.error(
      `  ${company.name} 실패:`,
      error.message
    );

    return {
      id: index,
      name: company.name,
      industry: company.industry,

      growth: 0,
      searchGrowth: 0,
      snsGrowth: 0,
      interestScore: 0,

      status: "수집 실패",

      customersShort:
        company.customers,

      customers:
        company.customers,

      description:
        "외부 데이터 수집에 실패했습니다.",

      products:
        company.products,

      updatedAt:
        formatDate(new Date()),

      newsCount: 0,
      newsActivityScore: 0,

      latestNews: [],

      searchHistory: [],
      snsHistory: []
    };
  }
}

async function main() {

  console.log("");
  console.log(
    "======================================"
  );
  console.log(
    " AI 제휴 후보 외부 데이터 수집"
  );
  console.log(
    "======================================"
  );
  console.log("");

  const seeds =
    JSON.parse(
      fs.readFileSync(
        SEED_FILE,
        "utf8"
      )
    );

  const results = [];

  for (
    let i = 0;
    i < seeds.length;
    i++
  ) {

    const result =
      await crawlCompany(
        seeds[i],
        i + 1
      );

    results.push(result);

    // 외부 사이트에 너무 빠르게 요청하지 않도록 대기
    await sleep(700);
  }

  results.sort(
    (a, b) =>
      b.interestScore -
      a.interestScore
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      results,
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "======================================"
  );

  console.log(
    `완료: ${results.length}개 업체`
  );

  console.log(
    `저장: ${OUTPUT_FILE}`
  );

  console.log(
    "======================================"
  );
}

function sleep(ms) {
  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});