const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const companiesPath = path.join(
  __dirname,
  "../data/companies.json"
);

const analysesPath = path.join(
  __dirname,
  "../data/analyses.json"
);

const companies = JSON.parse(
  fs.readFileSync(companiesPath, "utf-8")
);

// 우선 상위 5개 업체만 AI 분석
const targets = [...companies]
  .sort((a, b) => {
    return (b.interestScore || 0) - (a.interestScore || 0);
  })
  .slice(0, 5);

async function analyzeCompany(company) {
  console.log(`AI 분석 시작: ${company.name}`);

  const newsText = (company.latestNews || [])
    .slice(0, 10)
    .map((news, index) => {
      return `${index + 1}. ${news.title}`;
    })
    .join("\n");

  const prompt = `
당신은 금융 플랫폼 기업의 제휴사업 담당자입니다.

아래 외부 데이터를 기반으로 기업을 분석하고,
KB스타플랫폼과의 제휴 가능성을 검토해주세요.

중요:
- 제공된 데이터에 없는 사실을 확정적으로 만들어내지 마세요.
- 뉴스에서 확인되는 내용과 AI의 추론을 구분하세요.
- 구체적인 수치가 제공되지 않았다면 임의로 수치를 만들지 마세요.
- 과도한 홍보 문구는 사용하지 마세요.
- 실제 사업기획자가 참고할 수 있도록 작성하세요.

[기업 정보]
기업명: ${company.name}
업종: ${company.industry || "미정"}

[외부 데이터]
뉴스 수: ${company.newsCount || 0}
뉴스 활동 지수: ${company.newsActivityScore || 0}
외부 관심도: ${company.interestScore || 0}

[최근 뉴스]
${newsText || "최근 뉴스 데이터 없음"}

다음 JSON 형식으로만 답변하세요.

{
  "summary": "기업 및 최근 사업 동향 요약",
  "businessTrend": [
    "주요 사업 동향 1",
    "주요 사업 동향 2",
    "주요 사업 동향 3"
  ],
  "partnershipOpportunities": [
    {
      "title": "제휴 기회 제목",
      "description": "왜 제휴 기회가 될 수 있는지 설명",
      "expectedEffect": "기대 효과"
    },
    {
      "title": "제휴 기회 제목",
      "description": "왜 제휴 기회가 될 수 있는지 설명",
      "expectedEffect": "기대 효과"
    },
    {
      "title": "제휴 기회 제목",
      "description": "왜 제휴 기회가 될 수 있는지 설명",
      "expectedEffect": "기대 효과"
    }
  ],
  "recommendedStrategy": [
    "제휴 추진 전략 1",
    "제휴 추진 전략 2",
    "제휴 추진 전략 3"
  ],
  "riskFactors": [
    "고려해야 할 위험요소 1",
    "고려해야 할 위험요소 2"
  ]
}
`;

  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: prompt
  });

  const text = response.output_text;

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`${company.name} JSON 파싱 실패`);
    console.error(text);

    return {
      summary: "AI 분석 결과를 생성하지 못했습니다.",
      businessTrend: [],
      partnershipOpportunities: [],
      recommendedStrategy: [],
      riskFactors: []
    };
  }
}

async function main() {
  const existingAnalyses = fs.existsSync(analysesPath)
    ? JSON.parse(fs.readFileSync(analysesPath, "utf-8"))
    : {};

  for (const company of targets) {
    try {
      const analysis = await analyzeCompany(company);

      existingAnalyses[company.id] = {
        companyId: company.id,
        companyName: company.name,
        generatedAt: new Date().toISOString(),
        ...analysis
      };

      // 업체별 API 호출 사이에 잠깐 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(
        `${company.name} AI 분석 실패:`,
        error.message
      );
    }
  }

  fs.writeFileSync(
    analysesPath,
    JSON.stringify(existingAnalyses, null, 2),
    "utf-8"
  );

  console.log("AI 분석 데이터 저장 완료");
}

main();