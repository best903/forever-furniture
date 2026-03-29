---
name: ask
description: "코드베이스를 Read-only로 심층 조사하고 Director의 질문에 답변하는 스킬. 코드 수정 없이 조사/분석/이해만 수행한다. '/ask 이 함수 뭐하는거야?', '/ask 이 에러 원인이 뭐야?', '/ask 어떻게 구현하면 좋을까?' 등 코드 이해, 문제 조사, 의사결정 지원이 필요할 때 사용한다. plan 모드를 사용하지 않고 질문/조사만 필요할 때 이 스킬을 사용한다."
---

# Ask - Read-only 심층 조사 스킬

## 핵심 원칙

**절대 코드를 수정하지 않는다.** 이 스킬은 조사와 분석만 수행한다.

### 허용 도구 (Read-only)
- `Read`, `Glob`, `Grep` - 파일 탐색/읽기
- `WebSearch`, `WebFetch` - 웹 검색/조회
- `AskUserQuestion` - Director에게 역질문
- Synapse MCP: `find`, `expand`, `trace`

### 금지 도구
- `Edit`, `Write`, `NotebookEdit` - 파일 수정
- `Bash` - 커맨드 실행 (read-only 커맨드도 금지. Grep/Read/Glob으로 대체)
- `EnterPlanMode` - plan 모드 진입
- `Task` - subagent 생성

## 워크플로우

### 1. 질문 수신
Director의 질문을 받으면, 먼저 질문의 범위와 깊이를 판단한다.

### 2. 코드베이스 조사
Synapse를 최우선으로 활용하여 구조/관계/흐름을 파악한다:
1. `find(name)` -> 이름으로 심볼 검색
2. `expand(seeds, top_k, direction)` -> 관련 심볼을 중요도 순으로 탐색
3. `trace(symbol, direction)` -> caller/callee 직접 추적 (1-hop 기본, 최대 2)
4. 필요 시 `Read`, `Glob`, `Grep`으로 보충 조사

### 3. 역질문 (필요 시)
조사 중 불명확한 점이 발견되면 `AskUserQuestion`으로 Director의 의도를 확인한다.
- 질문의 범위가 넓을 때: 어떤 측면에 관심이 있는지
- 여러 해석이 가능할 때: 어떤 맥락에서의 질문인지
- 추가 정보가 필요할 때: 관련 배경이나 제약조건

### 4. 답변 제공
조사 결과를 구조화하여 명확하게 보고한다:
- 코드 위치와 핵심 로직 설명
- 호출 관계 및 영향 범위
- 발견된 문제점이나 주의사항
- (의사결정 질문인 경우) 대안 비교와 트레이드오프
