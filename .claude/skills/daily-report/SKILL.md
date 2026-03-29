---
name: daily-report
description: "오늘의 일간 리포트를 자동 생성합니다. 완료/진행 중/발견 이슈를 정리합니다. 작업 마무리 시 '/daily-report'로 호출합니다."
---

# Daily Report — 일간 리포트 생성 스킬

## 핵심 원칙

**비개발자도 알아볼 수 있게**, 오늘 한 일을 정리한다.

## 워크플로우

### 1. 정보 수집
- `Read`로 `mockup/dashboard-state.json` 읽기 → 태스크 상태 파악
- `Read`로 `plan.md` 읽기 → Phase 진행 현황 파악
- `Bash`로 `git log --since="today" --oneline` → 오늘 커밋 목록

### 2. 리포트 작성
- `reports/daily/YYYY-MM-DD.md` 파일 생성
- 형식:

```markdown
# 일간 리포트 — YYYY년 MM월 DD일

## 한줄 요약
> (오늘 가장 중요한 진전 한 줄)

## 오늘 완료한 것
- (완료된 태스크 목록, 쉬운 설명 포함)

## 진행 중인 것
- (아직 끝나지 않은 태스크, 현재 상태)

## 발견된 이슈
- (막힌 것, 예상 못한 문제, 결정 필요한 사항)

## 내일 할 것
- (다음 작업 목록)

## Phase 진행률
- Phase 0: N/8 (XX%)
- Phase 1: N/9 (XX%)
- ...
```

### 3. 대시보드 연동
- 리포트 생성 후 Director에게 요약 보고
