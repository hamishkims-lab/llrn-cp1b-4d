# LLRN CP1B 4D 공정관리 · 기록관리 플랫폼

Laguna Lakeshore Road Network Phase 1 · CP1B (Sucat – Alabang, STA 4+160 ~ 8+525.53) 현장의 공정표를 3D 조감도로 재생하고, 현장 실적을 받아 실적기반 공정표·보고서·기록을 관리하는 웹앱입니다. 서버 없이 Edge에서 HTML 파일 하나로 동작합니다.

> **비공개 저장소로 관리하세요.** 도면에서 만든 3D 형상, 공정표(General Schedule re3), 예시 실적이 들어 있습니다. 실제 현장 실적 파일(`LLRN_CP1B_실적.json`)과 수신함 파일은 `.gitignore`로 올라가지 않게 막아 두었습니다.

## 지금까지 된 것

| 버전 | 내용 |
| --- | --- |
| Rev.0~3 | 도면 기반 3D 모델, 위성지도(Esri) 배치, 공정표(MS Project XML·P6 XER) 업로드와 구조물 연결, 4D 재생, 계약 공기·주공정 |
| Rev.4 | 착공일 이동(전체 activity, 파일 캘린더 기준), 소스 분리 보관, 저장 사전점검 |
| Rev.5 | 실적 입력, 실적기반 공정표(Retained logic), 계획 대비 3D 색상, S-curve, 데이터 파일 |
| Rev.5a | 공정표 기준선 Rev.0~n, 실적으로 새 기준선, 수정 공정표 실적 이관 |
| Rev.6 | 가상 현장·메신저 시뮬레이터, 회신 해석(번호형·자유 문장), 검토함, 수신함 파일 |

자세한 기준은 [`docs/구성기준서.md`](docs/구성기준서.md), 버전별 변경은 [`CHANGELOG.md`](CHANGELOG.md).

## 폴더 구성

| 경로 | 내용 |
| --- | --- |
| `engine.js` | 공정 계산: 구조물 날짜(compute), CPM, 착공일 이동, 실적기반 공정표(progress), 기준선(rebaseline), S-curve(curve) |
| `importer.js` | MS Project XML · P6 XER 읽기, 기준 activity 자동 연결 |
| `sim_core.js` | 가상 현장: 작업반 배정, 계획 메시지, 시나리오, 회신 해석, 날짜 규칙 |
| `app_main.js` · `app_actual.js` · `app_sim.js` | 화면 (3D·공정표 / 실적·기준선·데이터 파일 / 메신저·검토함) |
| `shell.html` | 화면 틀(HTML·CSS). 위 파일들이 조립되어 들어감 |
| `data/` | 3D 모델(`model.glb`), 기본 공정표 re3(`SCHED0.json`), 연결 규칙(`CFG.json`) 등 |
| `pretest/` | Edge 저장 사전점검 페이지 |
| `tools/` | 예시 실적 만들기, 공구 경계 밖 형상 제외 |
| `tests/run_tests.js` | 핵심 계산 자동 시험 |
| `samples/` | 예시 실적(착공 2027.03.01, 기준일 2027.12.31), 수신함 예시 |
| `docs/` | 구성기준서, 수신함 형식, AI 일일보고 자동화 흐름도 |

## 만들기 · 시험

```bash
node tests/run_tests.js      # 핵심 계산 시험 (모두 PASS여야 함)
python assemble.py           # dist/LLRN_CP1B_4D_공정관리.html 생성
python pretest/build.py      # dist/LLRN_사전점검_파일저장.html 생성
```

GitHub에 올리면 Actions가 자동으로 시험하고 HTML을 조립합니다. 결과 파일은 Actions 실행 화면의 **Artifacts**에서 내려받습니다. `v6.0` 같은 태그를 붙이면 Release에 HTML이 첨부됩니다.

## 쓰는 방법 (요약)

1. `dist/LLRN_CP1B_4D_공정관리.html`을 Edge로 엽니다 (인터넷 연결 필요: Cesium 3D 엔진·위성지도).
2. 공기 현황 카드의 연필 → 착공일 입력 (예: 2027-03-01).
3. 실적 입력 → [폴더 연결]로 데이터 폴더 선택 → 기준일 지정 → 실적 입력 → [저장].
4. 시험해 볼 때는 [파일 열기]로 `samples/LLRN_CP1B_실적_예시_20271231.json`, 가상 현장 → [1개월].

## 앞으로

3단계 일보·주보·월보(포스코 양식 Excel), 만회 공정표, 주간·월간·3개월 공정표, MS Project XML 내보내기 → 메신저 대화 가져오기(WhatsApp·Viber) → 서신·통지 등록부, 계약 문서, 지연 사건 파일, 비용 기록(SCL Delay Protocol 6대 기록) → 2차 서버·DB·로그인.
