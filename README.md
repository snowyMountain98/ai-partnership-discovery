# AI 제휴 후보 발굴 시스템

외부 데이터 기반 유망 업체 발굴 및 AI 비즈니스 분석 PoC입니다.

## 현재 구현

- 유망 업체 목록
- 업체 검색
- 업종 필터
- 성장률 / 검색량 / SNS 증가율 정렬
- 업체 상세 페이지
- 검색/SNS 추이 차트
- AI 비즈니스 분석 결과
- AI 제휴 전략 결과
- 제휴 후보 저장(localStorage)
- GitHub Pages 자동 배포
- 데이터 자동 갱신 Workflow 기본 구조

## 실행

VS Code에서 Live Server로 `index.html`을 실행하거나 GitHub Pages로 배포합니다.

> `fetch()`로 JSON을 읽기 때문에 `file://`로 index.html을 직접 여는 것보다 Live Server를 사용하는 것을 권장합니다.

## GitHub Pages 배포

1. Repository에 파일을 업로드합니다.
2. `Settings > Pages`로 이동합니다.
3. `Build and deployment`의 Source를 `GitHub Actions`로 설정합니다.
4. `Actions > Deploy to GitHub Pages`를 실행합니다.
5. 배포 완료 후 생성된 Pages URL로 접속합니다.

## 실제 운영으로 확장할 부분

`data/companies.json`을 실제 외부 데이터 수집 결과로 교체합니다.

권장 구조:

외부 데이터
→ Node.js 수집
→ 데이터 정제
→ 업체별 지표 계산
→ AI 분석
→ JSON 생성
→ GitHub Pages

실제 AI API Key는 절대 HTML/JavaScript에 넣지 말고 GitHub Actions Secrets에 저장해야 합니다.
