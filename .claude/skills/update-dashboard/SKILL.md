---
name: update-dashboard
description: "대시보드 상태 파일(dashboard-state.json)을 업데이트합니다. 태스크 상태 변경, 에이전트 활동 기록 등을 반영합니다. 에이전트가 작업 시작/완료 시 자동 호출됩니다."
argument-hint: "[task-id] [new-status: todo|in-progress|review|done] 또는 [agent-name] [activity]"
---

# Update Dashboard — 대시보드 상태 업데이트 스킬

## 핵심 원칙

**dashboard-state.json을 업데이트**하여 대시보드가 실시간 반영되게 한다.

## 사용법

### 태스크 상태 변경
```
/update-dashboard task 4 in-progress
/update-dashboard task 4 done
```

### 에이전트 활동 기록
```
/update-dashboard agent Feature "카카오 로그인 구현 중"
/update-dashboard agent Feature idle
```

## 워크플로우

### 1. 인자 파싱
- `$ARGUMENTS`에서 대상(task/agent)과 값 추출

### 2. 상태 파일 업데이트
- `Read`로 `mockup/dashboard-state.json` 로드
- 해당 항목 업데이트
- `Write`로 저장

### 3. plan.md 동기화
- 태스크 완료(`done`) 시 plan.md의 해당 체크박스도 `[x]`로 변경

### 4. 요약 통계 재계산
- 전체 진행률, Phase별 진행률, 에이전트별 완료 수 갱신
