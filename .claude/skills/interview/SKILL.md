---
name: interview
description: Director의 요청을 심층 인터뷰하여 고품질 Plan을 작성합니다. 코드베이스 사전 분석 -> 심층 인터뷰 -> Plan 작성 -> /review-plan 자동 검증까지 수행합니다. 새로운 기능 구현, 아키텍처 변경, 복잡한 작업의 Plan 수립이 필요할 때 사용합니다.
argument-hint: "[구현할 기능 또는 작업 설명]"
---

# Plan Interviewer

서브에이전트들과 협력하여 심층 인터뷰를 수행하고 고품질 Plan을 작성한다.
**모든 subagent 호출 시 model은 opus를 사용.**

## 서브에이전트

| 에이전트 | 역할 | 호출 시점 |
|---------|------|----------|
| **codebase-analyzer** | 코드베이스 사전 분석 (Synapse MCP) | Phase 0 (필수) |
| **architecture-advisor** | 아키텍처 조언 | Phase 1 (복잡한 기술 결정 시) |
| **external-researcher** | 외부 문서/라이브러리 조사 | Phase 1 (라이브러리 사용 시) |

---

## Phase 0: 코드베이스 사전 분석

Director의 요청을 받으면 **즉시 codebase-analyzer를 호출**한다.

분석 결과 활용:
- 관련 코드 구조, 기존 패턴/컨벤션 파악
- 잠재적 충돌 지점 식별
- Director에게 확인해야 할 사항 목록화

## Phase 1: 심층 인터뷰

### 인터뷰 원칙
- **뻔하지 않은 질문**: 상투적 질문 금지, 심층적으로 접근
- **꼬리 질문**: Director 답변을 기반으로 파고들기
- **코드 기반 질문**: codebase-analyzer 결과를 기반으로 구체적 질문
- **완성까지 계속**: 모든 측면이 명확해질 때까지 인터뷰 지속
- **충분한 질문**: 질문 횟수를 아끼지 말라. 빠르게 끝내려 하지 말고, 필요한 만큼 충분히 많은 질문을 통해 깊이 파고들어라

### 다루어야 할 측면
- 기술적 구현 (아키텍처, 기술 스택, 성능, 확장성)
- UI/UX (사용자 경험, 인터페이스)
- 우려 사항 (잠재적 문제, 리스크, 보안)
- 트레이드오프 (선택지 간 장단점)
- 제약 조건 (리소스, 시간, 호환성)
- 기존 코드와의 관계 (패턴 준수, 충돌 가능성)

### 서브에이전트 호출 시점
- **architecture-advisor**: A vs B 아키텍처 결정, 복잡한 트레이드오프 분석, 방향 검증
- **external-researcher**: 구현에 라이브러리를 사용하는 경우 **반드시** 호출하여 최신 공식 문서를 조사하라. 오래된 지식에 의존하지 말고, 현재 버전의 API/사용법/best practice를 확인한다

### 인터뷰 완료 기준
- Director의 의도가 충분히 파악됨
- 모든 측면이 명확해짐
- codebase-analyzer가 제기한 확인 사항이 모두 해결됨

## Phase 2: Plan 작성

인터뷰 결과를 기반으로 Plan 파일을 작성한다.

### Plan 필수 포함 요소
1. 목표 -- 무엇을 달성하려 하는지
2. 배경 -- 왜 이 작업이 필요한지
3. 접근 방식 -- 어떻게 구현할 것인지
4. 태스크 목록 -- 체크박스 형식의 작업 단위
5. 고려 사항 -- 엣지 케이스, 제약 조건
6. 테스트 계획 -- 어떻게 검증할 것인지

### Double Check
작성 완료 후 자체 검토: 요구사항 누락, 기술적 타당성, 기존 코드 호환성.

## Phase 3: Plan 검증

`/review-plan` 스킬을 호출하여 자동 검증/수정 루프를 실행한다.

1. `/review-plan` 호출 (내부에서 피드백 0까지 반복)
2. 피드백 0 완료 즉시 `ExitPlanMode()` 호출 (AskUserQuestion 없이 — enforce-review-plan.py hook이 자동 승인)
3. `ExitPlanMode` 직후 `Skill(skill='todos-task', args='plan')` 호출

상세 호출 예시는 [references/examples.md](references/examples.md) 참조.
