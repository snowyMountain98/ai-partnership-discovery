# AI Partnership Discovery — KB스타플랫폼 가맹점 후보 발굴 PoC v6

## 목적
기존 KB스타플랫폼 거래사에서 나타나는 **상품·서비스 거래 구조**를 기준으로 신규 가맹점 후보를 여러 외부 채널에서 넓게 발굴하고, 기업명 검증을 통과한 후보를 상위 150개까지 저장합니다. 이후 상위 30개만 AI가 실제 가맹점 여부와 제휴 가능성을 정밀 검증합니다.

## v6 핵심 변경
### 1. Company Identity Resolver 추가
뉴스 제목이나 YouTube 채널명을 그대로 기업명으로 사용하지 않습니다.

- 법인명 표기: 가장 높은 신뢰도
- 기사 제목의 `기업명, 내용` / `기업명은…` 패턴
- 기업명 suffix 패턴
- Naver Local 업체명
- Naver Shopping 브랜드/제조사
- YouTube는 **채널명 자체를 기업명으로 사용하지 않고 영상 제목에서 기업명을 추출**
- 언론사, 방송사, 콘텐츠 채널, 일반 명사, 문장형 제목 제거
- 동일 기업명이 여러 외부 데이터에서 반복되는 경우 신뢰도 보강

### 2. Naver 401 처리 개선
Naver API가 401이면 동일 오류를 수십 번 출력하지 않고 첫 401 이후 Naver 요청을 중단합니다.

로그에는 다음과 같이 상태를 명확히 표시합니다.
- `not-configured`
- `configured`
- `active`
- `auth-failed-401`
- `error-xxx`

Naver 인증이 실패해도 Google News/YouTube 등 다른 채널로 후보 발굴은 계속됩니다.

### 3. AI 검증으로 150개가 사라지지 않도록 변경
AI 상위 30개 검증 결과는 `verified / excluded / error`로 기록합니다.

- Discovery 후보 150개는 기본적으로 모두 companies.json에 유지
- AI에서 제외된 후보는 `aiExcluded=true`
- 화면에서는 AI 제외 후보를 기본적으로 숨김
- AI 호출 실패 시 해당 후보는 `error` 상태로 유지

따라서 AI 검증 때문에 후보 수가 150개 → 80개처럼 급격하게 줄어들지 않습니다.

## 데이터 발굴 채널
1. Google News RSS — 기본 활성화
2. Google News의 SNS/블로그 색인 검색 — Instagram/YouTube/Naver Blog 등의 공개 색인 신호
3. Naver Search API — 선택 사항
   - News / Blog / Web / Local / Shopping
   - Local/Shopping은 실제 판매·상거래 사업자 후보 발굴에 사용
4. YouTube Data API — 선택 사항
   - 영상 제목에서 기업명 후보를 찾고 사업 활동 신호를 보강

## GitHub Actions Secrets
### 필수
- `OPENAI_API_KEY`

### 선택
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `YOUTUBE_API_KEY`

## 후보 수
- Discovery 최대 150개
- 최소 언급 1건
- 1차 가맹점 적합도 30점 이상
- 기업명 검증 통과 필요
- AI 상위 30개 검증

## 주의
자체 결제시스템이 공개자료에서 확인되지 않는 경우 `unknown`으로 처리합니다. `unknown`은 자체 결제시스템이 없다는 의미가 아닙니다.
