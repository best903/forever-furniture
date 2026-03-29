# todos 태스크 관리

팀 보드에서 작업 현황을 실시간 추적하기 위해, plan 작성 완료와 커밋 시점에 todos 태스크를 동기화한다.

- ExitPlanMode 승인 직후, 구현 시작 직전 → Skill `todos-task` 호출 (인자: plan)
- git commit 직후 → Skill `todos-task` 호출 (인자: commit)
