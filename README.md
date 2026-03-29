# Forever Furniture

이사 가구 판매 페이지. GitHub Pages로 무료 호스팅.

**URL**: https://best903.github.io/forever-furniture

## 가구 추가/수정 방법

`data/furniture.json`을 편집하세요.

```json
{
  "id": "new-item",          // URL 앵커 + 이미지 폴더명 (영문, 하이픈)
  "name": "가구 이름",
  "originalPrice": 500000,    // 정가 (숫자)
  "sellingPrice": 250000,     // 판매가 (숫자)
  "description": "상태, 메모 등",
  "detailUrl": "https://...", // 상품 페이지 링크 (없으면 "" 빈 문자열)
  "images": ["1.jpg", "2.jpg"],
  "sold": false               // 판매완료 시 true로 변경
}
```

### 사진 추가
1. `images/{가구id}/` 폴더 생성
2. 사진 파일을 `1.jpg`, `2.jpg` 등으로 넣기
3. JSON의 `images` 배열에 파일명 나열

### 판매완료 처리
JSON에서 해당 가구의 `"sold": false`를 `"sold": true`로 변경 후 push.

## QR 코드 생성 가이드

### 메인 페이지 QR
- URL: `https://best903.github.io/forever-furniture`

### 개별 가구 QR
- URL: `https://best903.github.io/forever-furniture#가구id`
- 예시: `https://best903.github.io/forever-furniture#sofa`

### QR 생성 방법
1. [QR Code Generator](https://www.qr-code-generator.com/) 접속
2. URL 입력
3. PNG 다운로드 후 인쇄

## 배포

GitHub Pages 설정:
1. 리포 Settings → Pages
2. Source: Deploy from a branch
3. Branch: `main`, Folder: `/ (root)`
4. Save

이후 `main` 브랜치에 push하면 자동 배포됩니다.

## 로컬 테스트

```bash
# 프로젝트 루트에서
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

> `file://` 프로토콜에서는 JSON fetch가 CORS 차단됩니다. 반드시 HTTP 서버를 사용하세요.
