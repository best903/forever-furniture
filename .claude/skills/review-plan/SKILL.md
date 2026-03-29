---
name: review-plan
description: Plan 파일에 대해 plan-reviewer subagent를 반복 호출하여 피드백 0이 될 때까지 자동 검증/수정 루프를 실행합니다. Plan 검증, Plan 리뷰, Plan 품질 검사가 필요할 때 사용합니다.
argument-hint: "<path/to/plan.md>"
---

# Plan Review Feedback Loop

**워크플로우**: Plan 읽기 → reviewer 검증 → 피드백 있으면 수정 → 재검증 → 피드백 0 → 완료

## Phase 1: Plan 파일 로드

- `$ARGUMENTS`가 비어있으면 `AskUserQuestion`으로 파일 경로 확인
- `Read` 도구로 Plan 파일 로드 (파일 미존재 시 에러 보고 후 종료)

## Phase 2: plan-reviewer 검증

Task 도구로 plan-reviewer subagent 호출 (`model: opus`).

프롬프트 구성:
- Plan 파일 경로 + 전체 내용 (원문 그대로)
- 이전 라운드의 피드백 및 수정 내용 (2회차 이상인 경우)

## Phase 3: 피드백 처리

### 피드백 있음
1. 각 이슈의 "제안" 항목 추출
2. `Edit` 도구로 Plan 파일 직접 수정
3. 수정된 Plan을 Read하여 Phase 2로 복귀

### 피드백 없음
reviewer가 "발견된 이슈 없음"을 반환하면 Phase 4로 진행.

### 루프 정책
- 횟수 제한 없음 -- 피드백 0이 될 때까지 반복

## Phase 4: 완료 보고

```
## Plan Review 완료

- **Plan 파일**: [파일 경로]
- **총 라운드**: N회
- **라운드별 요약**: Round 1: 피드백 N건 -- [수정 내용 요약] / ... / Round N: 피드백 0건
- **최종 결과**: 피드백 0
```
