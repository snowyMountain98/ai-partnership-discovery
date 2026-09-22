const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const companiesPath = path.join(__dirname, "../data/companies.json");
const analysesPath = path.join(__dirname, "../data/analyses.json");
const companies = JSON.parse(fs.readFileSync(companiesPath, "utf-8"));

// Discovery 단계에서 상위 30개만 AI로 정밀 검증한다.
const targets = [...companies]
  .sort((a, b) => (b.merchantFitScore || 0) - (a.merchantFitScore || 0))
  .slice(0, 30);

async function analyzeCompany(company) {
  console.log(`AI 가맹점 검증: ${company.name}`);

  const evidenceText = (company.latestNews || [])
    .slice(0, 8)
    .map((news, index) => `${index + 1}. [${news.sourceType || "external"}] ${news.title}`)
    .join("\n");

  const prompt = `
당신은 KB국민은행 KB스타플랫폼의 신규 가맹점 제휴 후보 발굴 담당자입니다.

목표는 유명한 기업을 찾는 것이 아니라 실제로 상품 또는 유료 서비스를 판매/제공하고 결제가 발생하는 사업자를 찾는 것입니다.

[가맹점 판단 기준]
- 실제 상품/용역 판매 또는 유료 서비스 제공
- 주문/구매/예약/예매/이용료/구독료 등의 거래 구조
- 온라인몰, 자사몰, 주문앱, 예약/예매 채널 등 결제 접점
- 기존 KB스타플랫폼 거래사에서 관찰되는 소비재, 식품/외식, 유통/B2B, 교육/돌봄, 여행/숙박/레저 등의 사업 유형과의 유사성

[제외]
- 은행, 카드사, 증권사, 보험사, 통신사
- PG/결제대행/결제 솔루션/결제 인프라/핀테크 사업자
- 언론사, 방송사, 뉴스 채널, 콘텐츠 채널
- 일반적인 정보성 플랫폼 또는 광고/미디어 사업자
- 공개자료에서 자체 Pay 또는 자체 결제시스템이 명시적으로 확인되는 경우

[기업명 검증]
현재 기업명은 외부 데이터에서 자동 추출되었습니다.
기업명이 실제 기업/브랜드를 가리키는지 함께 확인하세요.
뉴스 제목의 일부 문장, 상품명, 기사 제목, 유튜브 채널명, 일반 명사를 기업명으로 착각한 경우 isMerchantCandidate를 false로 하세요.

[중요]
- 제공된 근거에 없는 사실을 추정하지 마세요.
- 자체 결제시스템이 없다는 증거가 없으면 paymentSystemStatus는 unknown입니다.
- unknown은 탈락 사유가 아닙니다.
- 실제 판매/결제 근거를 merchantEvidence에 적으세요.

[기업]
기업명: ${company.name}
업종: ${company.industry}
1차 적합도: ${company.merchantFitScore}
기업명 추출 근거: ${company.nameEvidence || "없음"}
기업명 근거 횟수: ${company.nameEvidenceCount || 0}
발굴 근거: ${(company.discoverySignals || []).join(", ")}
추천 서비스: ${(company.fitServices || []).join(", ")}

[최근 외부 데이터]
${evidenceText || "없음"}

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

paymentSystemStatus는 existing / provider / unknown 중 하나입니다.
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
      isMerchantCandidate: true,
      merchantFitScore: company.merchantFitScore || 0,
      paymentSystemStatus: "unknown",
      paymentSystemEvidence: "AI 응답 파싱 실패",
      merchantEvidence: [],
      recommendedServices: company.fitServices || [],
      summary: "AI 분석 결과를 생성하지 못했습니다. 1차 발굴 결과를 유지합니다.",
      businessTrend: [],
      partnershipOpportunities: [],
      recommendedStrategy: [],
      riskFactors: ["AI 응답 파싱 실패로 추가 확인이 필요합니다."]
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

  // AI 결과와 무관하게 Discovery 후보를 먼저 모두 유지한다.
  const resultMap = new Map(
    companies.map(company => [
      company.id,
      { ...company, aiValidationStatus: "pending" }
    ])
  );

  for (const company of targets) {
    try {
      const analysis = await analyzeCompany(company);
      const current = resultMap.get(company.id);
      if (!current) continue;

      const finalScore = Math.max(
        0,
        Math.min(100, Number(analysis.merchantFitScore || current.merchantFitScore || 0))
      );

      const excluded =
        analysis.isMerchantCandidate === false ||
        analysis.paymentSystemStatus === "existing" ||
        analysis.paymentSystemStatus === "provider";

      resultMap.set(company.id, {
        ...current,
        merchantFitScore: finalScore,
        partnershipScore: finalScore,
        interestScore: finalScore,
        paymentSystemStatus: analysis.paymentSystemStatus || current.paymentSystemStatus,
        fitServices: analysis.recommendedServices?.length
          ? analysis.recommendedServices
          : current.fitServices,
        discoveryReason: analysis.summary || current.discoveryReason,
        aiMerchantEvidence: analysis.merchantEvidence || [],
        aiPaymentSystemEvidence: analysis.paymentSystemEvidence || "",
        aiValidationStatus: excluded ? "excluded" : "verified",
        aiExcluded: excluded
      });

      existingAnalyses[company.id] = {
        companyId: company.id,
        companyName: company.name,
        generatedAt: new Date().toISOString(),
        ...analysis
      };

      if (excluded) {
        console.log(`AI 검증 제외 표시: ${company.name}`);
      } else {
        console.log(`AI 검증 통과: ${company.name}`);
      }

      await new Promise(resolve => setTimeout(resolve, 700));
    } catch (error) {
      console.error(`${company.name} AI 분석 실패: ${error.message}`);
      const current = resultMap.get(company.id);
      if (current) {
        resultMap.set(company.id, {
          ...current,
          aiValidationStatus: "error",
          aiExcluded: false
        });
      }
    }
  }

  const allCandidates = [...resultMap.values()]
    .sort((a, b) => (b.merchantFitScore || 0) - (a.merchantFitScore || 0));

  fs.writeFileSync(companiesPath, JSON.stringify(allCandidates, null, 2), "utf-8");
  fs.writeFileSync(analysesPath, JSON.stringify(existingAnalyses, null, 2), "utf-8");

  const visible = allCandidates.filter(company => !company.aiExcluded);
  const excluded = allCandidates.filter(company => company.aiExcluded);

  console.log(`최종 후보 저장: ${allCandidates.length}개`);
  console.log(`화면 노출 후보: ${visible.length}개`);
  console.log(`AI 검증 제외: ${excluded.length}개`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
