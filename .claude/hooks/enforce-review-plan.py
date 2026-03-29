#!/usr/bin/env python3
"""
ExitPlanMode 호출 시 /review-plan 실행을 강제하는 PreToolUse hook.
ExitPlanMode 호출 전에 /review-plan이 실행되었는지 검증합니다.

review-plan 미실행 시 block, 실행 완료 시 통과 (사용자 승인 프롬프트 표시).
"""
import sys
import json
import os
import glob
import hashlib

GUARD_MARKER = "[PLAN REVIEW GUARD]"
MAX_BLOCKS = 2
DEBUG_LOG = os.path.expanduser("~/.claude/hooks/enforce-review-plan-debug.log")


def _debug(msg: str) -> None:
    """디버그 로그를 파일에 기록."""
    with open(DEBUG_LOG, "a") as f:
        f.write(msg + "\n")


def _extract_text(content) -> str:
    """content 필드에서 텍스트를 추출. str 또는 list[dict] 형식 모두 처리."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                # "text" (assistant text block) 또는 "content" (tool_result) 추출
                val = block.get("text") or block.get("content") or ""
                if isinstance(val, str):
                    parts.append(val)
            elif isinstance(block, str):
                parts.append(block)
        return " ".join(parts)
    return ""


def _create_pending_marker(hook_input: dict) -> None:
    """PostToolUse 미실행(Clear Context) 대비 pending marker 사전 생성."""
    try:
        session_id = hook_input.get("session_id", "")
        cwd = hook_input.get("cwd", "")
        if not session_id or not cwd:
            return

        plans_dir = os.path.join(cwd, "docs", "plans")
        plan_files = sorted(
            glob.glob(os.path.join(plans_dir, "*.md")),
            key=os.path.getmtime,
            reverse=True,
        )
        if not plan_files:
            return

        plan_path = plan_files[0]
        plan_hash = hashlib.md5(plan_path.encode()).hexdigest()[:12]

        claude_dir = os.path.expanduser("~/.claude")
        pending_file = os.path.join(claude_dir, f"ddalggak-pending-{plan_hash}")

        with open(pending_file, "w") as f:
            f.write(f"{session_id}|{plan_path}|{cwd}")
        _debug(f"Created pending marker: {pending_file}")
    except Exception as e:
        _debug(f"Failed to create pending marker: {e}")


def _pass_and_exit(reason: str) -> None:
    """review-plan 검증 완료 → 통과 (사용자 승인 프롬프트 표시)."""
    _debug(f"PASS: {reason}")
    sys.exit(0)


def main():
    _debug("=" * 50)
    _debug("Hook invoked")

    try:
        raw_input = sys.stdin.read()
        _debug(f"Raw stdin length: {len(raw_input)}")
        hook_input = json.loads(raw_input)
        _debug(f"Hook input keys: {list(hook_input.keys())}")
        _debug(f"hook_event_name: {hook_input.get('hook_event_name', 'N/A')}")
        _debug(f"tool_name: {hook_input.get('tool_name', 'N/A')}")
    except Exception as e:
        _debug(f"Failed to parse stdin: {e}")
        sys.exit(0)

    transcript_path = hook_input.get("transcript_path", "")
    _debug(f"transcript_path: {transcript_path}")
    if not transcript_path:
        _debug("No transcript_path, exiting")
        sys.exit(0)

    try:
        has_review_plan = False
        has_ddalggak = False
        block_count = 0
        entry_count = 0

        with open(transcript_path, "r") as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                except Exception:
                    continue

                entry_count += 1
                entry_type = entry.get("type", "")

                # transcript 구조: entry["message"]["content"]
                message = entry.get("message") or {}
                content = message.get("content") or ""
                text = _extract_text(content)

                # ddalggak 워크플로우 감지
                if not has_ddalggak and "ddalggak Dev Workflow" in text:
                    has_ddalggak = True

                # Skill tool_use 탐지 (assistant message의 content 배열에서)
                if entry_type == "assistant" and isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        if block.get("type") != "tool_use" or block.get("name") != "Skill":
                            continue
                        skill = (block.get("input", {}).get("skill") or "").lower()
                        if not has_review_plan and skill == "review-plan":
                            has_review_plan = True
                            _debug(f"Found review-plan Skill tool_use (entry #{entry_count})")

                # 이전 block 횟수 카운트 (무한 루프 방지)
                if entry_type == "user" and GUARD_MARKER in text:
                    block_count += 1

                # 조기 종료: review-plan 확인되면 통과
                if has_review_plan:
                    if has_ddalggak:
                        _create_pending_marker(hook_input)
                    _pass_and_exit("review-plan 검증 완료")

        _debug(f"Scan done: entries={entry_count}, review_plan={has_review_plan}, ddalggak={has_ddalggak}, blocks={block_count}")

        if has_review_plan:
            if has_ddalggak:
                _create_pending_marker(hook_input)
            _pass_and_exit("review-plan 검증 완료")

        # 무한 루프 방지
        if block_count >= MAX_BLOCKS:
            _pass_and_exit(f"Max blocks reached ({block_count})")

        # block
        _debug("BLOCKING ExitPlanMode")
        result = {
            "decision": "block",
            "reason": (
                f"{GUARD_MARKER} Plan 검증이 수행되지 않았습니다. "
                "/review-plan 스킬을 호출하여 Plan 검증을 수행하세요. "
                "예: Skill(skill='review-plan', args='<plan 파일 경로>')"
            ),
        }
        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        _debug(f"Exception: {e}")
        sys.exit(0)


if __name__ == "__main__":
    main()
