# AI Partnership Discovery — KB스타플랫폼 가맹점 후보 발굴 PoC

## 목적
기존 KB스타플랫폼 거래사에서 나타나는 **상품·서비스 거래 구조**를 기준으로 신규 가맹점 후보를 넓게 발굴하고, 상위 후보만 AI로 가맹점 적합성을 검증합니다.

## 데이터 발굴 채널
1. **Google News RSS** — 기본 활성화, 별도 API Key 불필요
2. **Google News의 SNS/블로그 색인 검색** — Instagram/YouTube/Naver Blog 등의 공개 색인 신호를 보조적으로 수집
3. **Naver Search API** — 선택 사항
   - News
   - Blog
   - Web
   - Local
   - Shopping
   - 특히 Local/Shopping은 실제 판매·상거래 사업자 후보를 넓히는 데 사용
4. **YouTube Data API** — 선택 사항
   - 최근 영상 검색을 통해 브랜드/판매 활동 신호 보강

> Instagram/TikTok 등의 공식 API를 무조건 직접 연결하는 구조가 아닙니다. 플랫폼별 API 접근권한과 이용조건이 다르므로, 현재 MVP에서는 공개 검색/색인과 Naver/YouTube 공식 API를 조합합니다.

## GitHub Actions Secrets
### 필수
- `OPENAI_API_KEY`

### 선택
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `YOUTUBE_API_KEY`

Naver Secret이 없으면 Google News 기반으로 계속 실행됩니다.
YouTube Key가 없으면 YouTube 검색만 건너뜁니다.

## 후보 수
- Discovery 단계: 최대 **150개** 저장
- 최소 언급 수: 1건
- 1차 가맹점 적합도: 30점 이상
- AI 검증: 상위 **30개** 우선 실행
- AI 검증을 받지 않은 후보도 `1차 발굴` 상태로 화면에 유지

따라서 AI 호출이 일부 실패하더라도 100개 이상의 1차 후보를 화면에서 유지할 수 있습니다.

## 주의
자체 결제시스템이 공개자료에서 확인되지 않는 경우 `unknown`으로 처리합니다. `unknown`은 자체 결제시스템이 없다는 의미가 아닙니다.
