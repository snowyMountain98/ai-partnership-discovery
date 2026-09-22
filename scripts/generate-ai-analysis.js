const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const companiesPath = path.join(__dirname, "../data/companies.json");
const analysesPath = path.join(__dirname, "../data/analyses.json");
const companies = JSON.parse(fs.readFileSync(companiesPath, "utf-8"));

// 발굴 단계에서 이미 가맹점 적합도를 1차 필터링했으므로 상위 후보만 AI 검증
const targets = [...companies]
  .sort((a, b) => (b.merchantFitScore || 0) - (a.merchantFitScore || 0))
  .slice(0, 10);

async function analyzeCompany(company) {
  console.log(`AI 가맹점 검증 시작: ${company.name}`);

  const newsText = (company.latestNews || []).slice(0, 10).map((news, index) => `${index + 1}. ${news.title}`).join("\n");

  const prompt = `
당신은 KB국민은행 KB스타플랫폼의 가맹점 제휴 발굴 담당자입니다.

KB스타플랫폼은 기업/가맹점의 상품·서비스 결제에 사용할 수 있는 지급결제 서비스이며,
브랜드Pay, 정기결제, 법인결제(B2B), 현금영수증, 결제·정산 관리 등의 기능을 제공합니다.

이번 분석의 목적은 '유망한 기술기업'을 찾는 것이 아니라,
실제로 고객에게 상품 또는 유료 서비스를 판매하여 결제가 발생하는 '가맹점 후보'를 찾는 것입니다.

아래 기준을 반드시 적용하세요.

[최우선 대상]
- 온라인몰, 자사몰, 브랜드몰 등에서 상품을 판매하는 기업
- 자체 온라인 주문/예약/예매 채널에서 유료 상품·서비스를 판매하는 기업
- 숙박, 여행, 교육, 레저, 티켓, 헬스케어 등 고객 결제가 발생하는 서비스 사업자
- 구독/멤버십 상품을 판매하는 사업자

[제외 대상]
- 은행, 카드사, 증권사, 보험사, 통신사
- 네이버, 카카오, 메타, 아마존 같은 대형 플랫폼/빅테크 자체
- 카카오페이, 네이버페이, 토스 등 결제/핀테크 사업자
- PG사, 결제대행사, 결제 솔루션 사업자
- 자체 간편결제/자체 페이/자체 결제시스템을 이미 구축했다는 공개 근거가 있는 기업

[중요한 판단 원칙]
- 뉴스에 근거가 없는 사실은 추정하지 마세요.
- '결제 시스템이 없다'는 것을 확인할 수 없다면 없다고 단정하지 말고 '확인 필요'로 표시하세요.
- 자체 결제 시스템이 명시적으로 확인되면 대상에서 제외해야 합니다.
- 단순히 앱이나 플랫폼을 운영한다는 이유만으로 가맹점이라고 판단하지 마세요.
- 상품/서비스 판매 및 고객 결제 가능성이 실제 기사에서 확인되는지를 가장 중요하게 보세요.

[기업 정보]
기업명: ${company.name}
업종: ${company.industry || "미정"}
1차 가맹점 적합도: ${company.merchantFitScore || 0}
1차 추천 서비스: ${(company.fitServices || []).join(", ") || "없음"}
1차 발견 근거: ${(company.discoverySignals || []).join(", ") || "없음"}

[최근 뉴스]
${newsText || "최근 뉴스 없음"}

다음 JSON 형식으로만 답변하세요.

{
  "isMerchantCandidate": true,
  "merchantFitScore": 0,
  "paymentSystemStatus": "unknown",
  "paymentSystemEvidence": "",
  "merchantEvidence": ["실제 상품/서비스 판매 근거"],
  "recommendedServices": ["브랜드Pay"],
  "summary": "가맹점 후보 여부와 근거를 요약",
  "businessTrend": ["사업 동향 1", "사업 동향 2"],
  "partnershipOpportunities": [
    {
      "title": "제휴 기회",
      "description": "가맹점 입장에서 KB스타플랫폼을 도입할 이유",
      "expectedEffect": "기대 효과"
    }
  ],
  "recommendedStrategy": ["제휴 전략 1", "제휴 전략 2"],
  "riskFactors": ["확인해야 할 사항 1", "확인해야 할 사항 2"]
}

반드시 다음 중 하나로 paymentSystemStatus를 작성하세요:
- "existing": 자체 결제 시스템/자체 페이 등이 공개 근거로 확인됨
- "provider": 결제/PG/핀테크 사업자임
- "unknown": 공개 뉴스만으로 확인되지 않음

isMerchantCandidate가 false이면 가맹점 후보로 보기 어려운 이유를 summary에 명확하게 작성하세요.
`;

  const response = await client.responses.create({ model: "gpt-5-mini", input: prompt });
  const text = response.output_text;

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`${company.name} JSON 파싱 실패`);
    return {
      isMerchantCandidate: false,
      merchantFitScore: 0,
      paymentSystemStatus: "unknown",
      paymentSystemEvidence: "AI 응답 파싱 실패",
      merchantEvidence: [],
      recommendedServices: [],
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

  // 기존 분석 중 이번 발굴에 존재하지 않는 기업은 제거하여 화면에 오래된 분석이 남지 않게 함
  const validIds = new Set(companies.map(company => company.id));
  for (const id of Object.keys(existingAnalyses)) {
    if (!validIds.has(id)) delete existingAnalyses[id];
  }

  const verifiedCompanies = [];

  for (const company of targets) {
    try {
      const analysis = await analyzeCompany(company);

      const finalScore = Math.max(0, Math.min(100, Number(analysis.merchantFitScore || company.merchantFitScore || 0)));
      const excluded = !analysis.isMerchantCandidate || analysis.paymentSystemStatus === "existing" || analysis.paymentSystemStatus === "provider";

      if (excluded) {
        console.log(`제외: ${company.name}`);
        continue;
      }

      const updatedCompany = {
        ...company,
        merchantFitScore: finalScore,
        partnershipScore: finalScore,
        interestScore: finalScore,
        paymentSystemStatus: analysis.paymentSystemStatus || company.paymentSystemStatus,
        fitServices: analysis.recommendedServices?.length ? analysis.recommendedServices : company.fitServices,
        discoveryReason: analysis.summary || company.discoveryReason,
        aiMerchantEvidence: analysis.merchantEvidence || [],
        aiPaymentSystemEvidence: analysis.paymentSystemEvidence || ""
      };

      verifiedCompanies.push(updatedCompany);

      existingAnalyses[company.id] = {
        companyId: company.id,
        companyName: company.name,
        generatedAt: new Date().toISOString(),
        ...analysis
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`${company.name} AI 분석 실패:`, error.message);
    }
  }

  // AI 검증을 통과한 기업만 최종 화면에 남김
  verifiedCompanies.sort((a, b) => (b.merchantFitScore || 0) - (a.merchantFitScore || 0));
  fs.writeFileSync(companiesPath, JSON.stringify(verifiedCompanies, null, 2), "utf-8");
  fs.writeFileSync(analysesPath, JSON.stringify(existingAnalyses, null, 2), "utf-8");

  console.log(`AI 검증 완료: ${verifiedCompanies.length}개 가맹점 후보 저장`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
