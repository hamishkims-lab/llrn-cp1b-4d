# 알라방 화물차 운송 경로 조사 (Route Survey)

LLRN CP1B 현장(Sitio Anahaw, Alabang)으로 레미콘·트레일러 등 공사 차량이 들어올 수 있는지 검토하는 단일 HTML 페이지입니다. 서버 없이 Edge·Chrome에서 열고, 지도·경로 계산에는 인터넷 연결이 필요합니다.

## 화면

| 화면 | 내용 |
| --- | --- |
| 개요·종합 | 전체 위치도, 판정 포인트 N1~N9 종합 판정표 |
| 경로 1 · 경로 2 · 공통 구간 | 포인트별 위성지도·Street View·판정 |
| 경로 직접 설정 | 출발·경유·도착 좌표 지정(지도 클릭·좌표·지도 링크), 고가/지상 도로 선택, 차량별 회전 궤적(실축척), 회전 지점 Street View·개선 아이디어, 트럭 밴 판정·추천 출발 시각, OSM 제한 표지, 차량 규정 점검, 경로 저장·링크 복사 |
| 리스크·체크리스트 | 권고 조치, 현장 확인 항목, 트럭 밴·벌금 규정표, 참고 자료 |

## 파일

| 파일 | 내용 |
| --- | --- |
| `template.html` | 화면 틀·CSS (GS E&C Enterprise UI 토큰) |
| `script.js` | 보고서 화면(지도·포인트·탭) |
| `planner.js` | 경로 직접 설정(OSRM 경로, Overpass 도로·행정구역·제한 표지, 회전 궤적 모델, 트럭 밴 규칙) |
| `data.js` | 판정 포인트(NODES)와 경로 1·2 선형(ROUTES) |
| `assets/` | 공식 로고·심볼 SVG (원본 그대로 사용) |
| `build.py` | 단일 HTML 조립 |

## 만들기

```bash
python route-survey/build.py          # dist/alabang_route_survey.html 생성
```

`main`에 push하면 GitHub Actions가 조립·문법 검사 후 Actions Artifacts와 Pages(`/route-survey.html`)에 올립니다.

## 외부 서비스

- 경로: OSRM 공개 서버(`router.project-osrm.org`) — 승용차 기준, 일방통행·회전 제한 반영
- 도로 폭·차로·고가 여부·행정구역·제한 표지: Overpass API(OpenStreetMap)
- 지도·Street View: Google 지도 타일·임베드

## 한계

- 회전 궤적은 앞축이 차로를 따라가고 뒷축이 끌려오는 단순 모델(최소회전반경 원호, 바깥쪽 벌림 0~3 m 중 최적)이며, 도로 폭은 OSM 태그 또는 등급별 기본값 추정입니다. 정밀 검토는 AutoTURN 등으로 하십시오.
- 트럭 밴 시간대·벌금은 공개 자료(2019 NCTS 검토, 2026-04 MMDA 보도 등) 기준이므로 운행 전 MMDA·시청에 현행 기준을 확인하십시오.
