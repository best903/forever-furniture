---
name: todos-task
description: todos 태스크 라이프사이클 관리
---

# todos 태스크 라이프사이클 관리

plan 모드는 main agent에서 MCP를 직접 호출하고, commit 모드는 백그라운드 에이전트로 위임한다.

## 사용법

- `/todos-task plan` — 플랜 승인 후 구현 시작 직전 태스크 생성/할당
- `/todos-task commit` — 커밋 후 태스크 완료 처리 (백그라운드 에이전트 위임)

## 공통 규칙

- **plan 모드**: main agent에서 MCP 도구(`mcp__todos__*`)를 직접 호출
- **commit 모드**: 백그라운드 Task agent로 실행 (사용자 대기 없음)
- **프로젝트**: `mcp__todos__list_projects`로 프로젝트명 매칭. 없으면 `mcp__todos__create_project` (color: 프로젝트 성격에 어울리는 hex 색상 자유 선택)

## plan 모드

> 플랜 승인 후, 구현 시작 직전에 수행

**컨텍스트 수집:**
- 프로젝트명: `git remote get-url origin | sed 's|.*/||; s|\.git$||'` (Bash)
- Plan 제목/요약: 현재 대화 컨텍스트에서 참조 (Bash 불필요)

**워크플로우:**
1. 프로젝트 조회/생성하여 projectId 확보
2. `mcp__todos__list_tasks`를 status별 2회 병렬 호출 (shared, claimed) -- active 태스크만 조회하여 매칭 판단
3. 분기:
   - 매칭 없음 -- `create_task` (title: Plan 제목 기반, description: Plan 요약 (Markdown 형식), projectId) -> `claim_task`
   - shared -- `claim_task`
   - claimed (내 것) 또는 done -- skip
4. 최종 결과를 한 줄로 출력

## commit 모드 (백그라운드)

> git commit 직후 수행. 백그라운드 에이전트로 실행하여 사용자 대기 없이 처리.

### 메인 에이전트 절차

1. **git 정보 수집** (단일 Bash):
   ```bash
   echo "$(git remote get-url origin | sed 's|.*/||; s|\.git$||')" && git log -1 --format=%s && git log -1 --format=%b && git rev-parse HEAD; git remote get-url origin
   ```
2. **백그라운드 에이전트 스폰** — 아래 프롬프트 템플릿에 git 정보를 채워서 전달:
   - Task 도구: `subagent_type: general-purpose`, `run_in_background: true`, `model: haiku`
3. **즉시 다음 작업 진행** — 에이전트 결과를 기다리지 않음

### 에이전트 프롬프트 템플릿

수집한 git 정보를 `{placeholder}`에 채워서 전달:

```
todos 팀 보드 태스크를 커밋 정보로 완료 처리해줘.

## Git 정보
- 프로젝트: {project}
- 커밋 제목: {subject}
- 커밋 본문: {body}
- 커밋 해시: {hash}
- 리모트 URL: {remoteUrl}

## 공통 규칙
- 프로젝트: mcp__todos__list_projects로 "{project}" 매칭. 없으면 create_project (color: 성격에 맞는 hex)

## 워크플로우
1. mcp__todos__list_projects로 "{project}" 매칭/생성하여 projectId 확보
2. mcp__todos__list_tasks를 status별 3회 병렬 호출 (shared, claimed, done)
3. 커밋 메시지 기반 태스크 매칭 후 분기:
   - shared 매칭 → claim_task → complete_task
   - claimed (내 것) 매칭 → complete_task
   - done 매칭 → skip (이미 완료)
   - 매칭 없음 → create_task (title: 커밋 제목, description: 커밋 본문 (Markdown 형식), projectId) → complete_task
4. GitHub 커밋 링크를 add_comment로 댓글 추가
   - 형식: https://github.com/{owner}/{repo}/commit/{hash}
   - SSH(git@github.com:owner/repo.git) / HTTPS 모두 동일 형식으로 변환
```
