# LLRN CP1B 4D 공정관리 — 작업 규칙

- 답변과 문서는 한국어로 쓴다.
- 앱은 서버 없이 Edge에서 여는 단일 HTML이다. 소스를 고친 뒤 `python assemble.py`로 `dist/LLRN_CP1B_4D_공정관리.html`을 다시 만든다 (dist/는 저장소에 올리지 않음).
- 고친 뒤에는 반드시 `node tests/run_tests.js`를 돌려 모두 PASS인지 확인한다. 새 기능에는 시험 항목을 추가한다.
- 한 단계(또는 의미 있는 수정)가 끝날 때마다:
  1. `CHANGELOG.md` 맨 위에 버전·날짜·내용 한 줄 추가, 필요하면 `docs/구성기준서.md`에 절 추가
  2. 커밋하고 `main`에 push (GitHub Actions가 시험·빌드)
  3. 사용자의 PC가 연결되어 있으면 빌드한 HTML과 구성기준서를 도면 폴더에도 저장: `…\01. 도면\00 조감도_GIS\LLRN_CP1B_4D_공정관리.html`, `…\01. 도면\LLRN_CP1B_4D_공정관리_구성기준.md`
- 실제 현장 실적 파일(`LLRN_CP1B_실적.json`), 가상 현장 파일, history, 수신함 파일은 저장소에 올리지 않는다 (.gitignore).
- 공정 계산 기준: 실적은 세부 activity의 uid에 붙인다. 실적기반 공정표는 Retained logic, 공정표 파일 캘린더, 남은 기간 = 원기간 × (1 − %). 날짜는 현장 시각(UTC+8)이고, 07:00 전 회신은 전날 실적.
- 회사 보안상 Telegram·Teams 봇은 쓸 수 없다. 메신저(WhatsApp·Viber)는 대화 내보내기 파일을 읽는 방식으로 연결한다.
