# 서브에이전트 호출 예시

## codebase-analyzer

```
Director의 요청: "사용자 인증 기능을 JWT 기반으로 변경하고 싶습니다."

codebase-analyzer에게 요청:
- 현재 인증 관련 코드 구조 분석
- 기존 인증 패턴 파악
- JWT 도입 시 영향 받을 코드 영역 식별
- 잠재적 충돌 지점 확인
```

## architecture-advisor

```
상황: JWT 저장 방식 결정 필요
- 옵션 A: localStorage
- 옵션 B: httpOnly Cookie
- 옵션 C: Memory + Refresh Token

architecture-advisor에게 요청:
- 각 옵션의 보안성, 사용 편의성, 구현 복잡도 분석
- 프로젝트 상황에 맞는 권고안 제시
```

## external-researcher

```
주제: FastAPI에서 JWT 인증 구현

external-researcher에게 요청:
- FastAPI 공식 문서의 JWT 인증 가이드
- python-jose 또는 PyJWT best practice
- 유사 프로젝트의 구현 사례
```

## /review-plan 스킬 호출

```
Skill tool 호출:
- skill: review-plan
- args: "docs/plans/001-jwt-authentication.md"
```
