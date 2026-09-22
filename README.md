# KB스타플랫폼 가맹점 제휴 후보 발굴 V8

외부 데이터에서 상품·서비스를 실제로 판매하는 기업/사업자를 발굴하고, KB스타플랫폼 제휴 적합도를 계산한 뒤 상위 후보를 AI로 분석하는 PoC입니다.

## V8 주요 변경

- NAVER API HUB 기준으로 네이버 수집 로직 전면 수정
- 기존 `openapi.naver.com/v1/search/*` 사용 제거
- NAVER API HUB Search API 사용
  - News: `/search/v1/news`
  - Blog: `/search/v1/blog`
  - Web: `/search/v1/webkr`
  - Cafe: `/search/v1/cafearticle`
  - Local: `/search/v1/local`
- NAVER API HUB 인증 헤더 사용
  - `X-NCP-APIGW-API-KEY-ID`
  - `X-NCP-APIGW-API-KEY`
- Naver Local은 실제 업체명을 직접 받으므로 높은 신뢰도로 기업/사업자 후보에 반영
- Naver News/Web은 기업의 판매·주문·서비스 활동을 발견하는 용도로 사용
- Naver Blog/Cafe는 기업명 직접 추출보다 거래 활동 보강 신호로 사용
- Naver Shopping Search는 사용하지 않음. NAVER API HUB 문서상 Shopping Insight는 검색 트렌드/클릭 추이 분석 API이므로 기업명 후보 발굴용 검색 API와 용도가 다릅니다.
- Naver API 인증 오류가 발생하면 첫 401에서 중단하고 Google News/YouTube로 계속 진행
- YouTube 채널명을 기업명으로 직접 사용하지 않고 영상 제목에서 기업명 후보를 찾음
- 기업명 Identity Resolver를 통해 언론사·일반명사·문장형 제목을 제거

## GitHub Actions Secrets

### 필수

- `OPENAI_API_KEY`

### Naver 사용 시

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`

주의: 위 두 값은 기존 네이버 Open API가 아니라 **NAVER Cloud Platform > NAVER API HUB > Application**에서 발급한 Client ID / Client Secret을 사용해야 합니다.

### YouTube 사용 시

- `YOUTUBE_API_KEY`

## 실행

로컬 실행이 필요하지 않습니다. GitHub Actions의 `Update Company Data`를 실행하면 됩니다.

1. `npm install`
2. `npm run discover`
3. `npm run ai`
4. 변경된 JSON commit/push

## NAVER API HUB 호출량

현재 discovery 단계는 약 37개 검색어 × 5개 API 유형으로 동작하므로 약 185회의 검색 API 요청을 수행합니다. Search API의 공식 일일 호출 한도(25,000회)보다 충분히 낮은 범위입니다.


## V8 기업명 정제 기준

- 검색 결과의 **첫 단어를 기업명으로 추정하는 규칙을 제거**했습니다.
- `AI로`, `도매몰`, `프랜차이즈`, `대전`, `명절`, `10월`, `부천`, `지금`, `혹시`, `프리미엄`, `스크랩`, `당일`, `식품업계`, `과자`, `제조사`, `외식`, `UAE`, `전북`, `그랜드`, `동대문`, `수원`, `1인`, `춘천` 등 실제 실행에서 확인된 일반어/지역/콘텐츠형 오탐을 차단합니다.
- Naver Blog/Cafe/Web은 제목의 첫 단어를 기업명으로 사용하지 않고, 법인명/명시적 기업명 패턴만 제한적으로 사용합니다.
- Naver Local은 API가 업체명을 직접 제공하므로 업체명 후보로 사용하되 일반어·지역명은 별도 차단합니다.
- 검색어에 포함된 `온라인몰`, `주문`, `판매` 등의 단어를 적합도 점수 계산에서 제외했습니다. **검색어 자체 때문에 거래 신호가 생기는 문제를 제거**했습니다.
- Local을 제외한 후보는 서로 다른 링크/채널에서 기업명이 반복 확인되어야 최종 후보로 저장합니다.
- 기존 자체 결제시스템/결제사업자 신호가 확인되면 후보에서 제외합니다.
