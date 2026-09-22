const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const companiesPath = path.join(__dirname, "../data/companies.json");
const analysesPath = path.join(__dirname, "../data/analyses.json");
const companies = JSON.parse(fs.readFileSync(companiesPath, "utf-8"));

// 1차 Discovery 상위 후보를 AI가 실제 가맹점인지 재검증
const targets = [...companies]
  .sort((a, b) => (b.merchantFitScore || 0) - (a.merchantFitScore || 0))
  .slice(0, 30);

async function analyzeCompany(company) {
  console.log(`AI 가맹점 검증: ${company.name}`);

  const newsText = (company.latestNews || [])
    .slice(0, 8)
    .map((news, index) => `${index + 1}. ${news.title}`)
    .join("\n");

  const prompt = `
당신은 KB국민은행 KB스타플랫폼의 신규 가맹점 제휴 후보 발굴 담당자입니다.

KB스타플랫폼 가맹점은 국내 온·오프라인에서 상품 또는 용역을 판매/제공하고,
스타플랫폼을 통해 고객 결제가 가능한 사업자입니다.
브랜드Pay는 간편결제와 함께 정기결제, 법인결제(B2B), 현금영수증, 결제·정산 관리 기능을 제공합니다.

이번 목적은 '유명한 회사'나 '기술기업'을 찾는 것이 아니라,
기존 KB스타플랫폼 거래사와 유사한 '실제 거래 발생 사업자'를 찾는 것입니다.

[기존 거래사에서 관찰된 패턴]
- 패션/의류/뷰티/생활용품 등 소비재 판매 기업
- 식품 제조·판매 및 외식/프랜차이즈 기업
- 커피/식음료 사업자
- B2B 유통·상품 주문 플랫폼
- 약국/병원 등 특정 업종 대상 상품 유통 서비스
- 교육/돌봄/공공서비스 중 이용료 결제가 발생하는 서비스
- 여행/숙박/레저/티켓/예약 사업자
- 대형 유통/소비자 접점이 있는 기업

[최우선 판단]
1. 실제 상품 또는 유료 서비스를 판매/제공하는가?
2. 고객이 주문/구매/예약/예매/이용료/구독료 등을 결제하는 구조가 확인되는가?
3. 온라인몰, 자사몰, 주문앱, 예약/예매 채널 등 결제 접점이 확인되는가?
4. KB스타플랫폼의 결제 서비스가 들어갈 만한 사업 구조인가?

[제외]
- 은행, 카드사, 증권사, 보험사, 통신사
- 카카오/네이버/메타/아마존 같은 대형 플랫폼/빅테크 자체
- 카카오페이/네이버페이/토스 등 결제·핀테크 사업자
- PG사/결제대행/결제 솔루션 사업자
- 자체 Pay 또는 자체 결제시스템이 이미 구축되었다는 명시적 공개 근거가 있는 경우

[중요]
- 뉴스에 없는 사실을 추정하지 마세요.
- 자체 결제시스템이 없다고 확인할 수 없으면 'unknown'으로 두세요.
- 'unknown'은 탈락 사유가 아닙니다.
- 자체 결제시스템이 명시적으로 확인될 때만 existing으로 판단하세요.
- 단순히 '플랫폼', '앱', '온라인 서비스'라는 이유만으로 가맹점이라고 판단하지 마세요.
- 실제 판매/결제 근거를 merchantEvidence에 적으세요.

[기업]
기업명: ${company.name}
업종: ${company.industry}
1차 적합도: ${company.merchantFitScore}
발굴 근거: ${(company.discoverySignals || []).join(", ")}
추천 서비스: ${(company.fitServices || []).join(", ")}

[최근 뉴스]
${newsText || "없음"}

JSON만 반환하세요.
{
  "isMerchantCandidate": true,
  "merchantFitScore": 0,
  "paymentSystemStatus": "unknown",
  "paymentSystemEvidence": "",
  "merchantEvidence": [],
  "recommendedServices": [],
  "summary": "",
  "businessTrend": [],
  "partnershipOpportunities": [
    {
      "title": "",
      "description": "",
      "expectedEffect": ""
    }
  ],
  "recommendedStrategy": [],
  "riskFactors": []
}

paymentSystemStatus는 반드시 existing / provider / unknown 중 하나입니다.
`;

  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: prompt
  });

  try {
    return JSON.parse(response.output_text);
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

  const validIds = new Set(companies.map(company => company.id));
  for (const id of Object.keys(existingAnalyses)) {
    if (!validIds.has(id)) delete existingAnalyses[id];
  }

  // AI가 검증하지 않은 후보도 화면에 남겨 '미검증' 상태로 보여준다.
  // AI 검증 결과가 있을 경우에만 점수/서비스를 덮어쓴다.
  const resultMap = new Map(companies.map(company => [company.id, { ...company, aiValidationStatus: "pending" }]));

  for (const company of targets) {
    try {
      const analysis = await analyzeCompany(company);
      const finalScore = Math.max(0, Math.min(100, Number(analysis.merchantFitScore || company.merchantFitScore || 0)));
      const excluded = !analysis.isMerchantCandidate || analysis.paymentSystemStatus === "existing" || analysis.paymentSystemStatus === "provider";

      const current = resultMap.get(company.id);
      if (!current) continue;

      if (excluded) {
        resultMap.delete(company.id);
        console.log(`AI 검증 제외: ${company.name}`);
      } else {
        resultMap.set(company.id, {
          ...current,
          merchantFitScore: finalScore,
          partnershipScore: finalScore,
          interestScore: finalScore,
          paymentSystemStatus: analysis.paymentSystemStatus || current.paymentSystemStatus,
          fitServices: analysis.recommendedServices?.length ? analysis.recommendedServices : current.fitServices,
          discoveryReason: analysis.summary || current.discoveryReason,
          aiMerchantEvidence: analysis.merchantEvidence || [],
          aiPaymentSystemEvidence: analysis.paymentSystemEvidence || "",
          aiValidationStatus: "verified"
        });
      }

      existingAnalyses[company.id] = {
        companyId: company.id,
        companyName: company.name,
        generatedAt: new Date().toISOString(),
        ...analysis
      };

      await new Promise(resolve => setTimeout(resolve, 700));
    } catch (error) {
      console.error(`${company.name} AI 분석 실패: ${error.message}`);
    }
  }

  const verifiedCompanies = [...resultMap.values()]
    .sort((a, b) => (b.merchantFitScore || 0) - (a.merchantFitScore || 0));

  fs.writeFileSync(companiesPath, JSON.stringify(verifiedCompanies, null, 2), "utf-8");
  fs.writeFileSync(analysesPath, JSON.stringify(existingAnalyses, null, 2), "utf-8");

  console.log(`최종 가맹점 후보: ${verifiedCompanies.length}개 저장`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
