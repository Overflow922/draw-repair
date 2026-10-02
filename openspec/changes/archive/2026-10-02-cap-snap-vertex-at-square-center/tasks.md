## 1. Цель «торец»: вершина в центре квадрата (`src/wall-snap.ts`)

- [x] 1.1 Добавить в `Candidate` поле `base` (середина стороны квадрата, приставленной к грани/торцу); `wallSnap` переносит его в `VertexSnap` неперечислимым, как `normal`/`target` (design D1; spec «Квадрат при установке стены»; тесты CV-SHAPE-1, REF-SHAPE-1)
- [x] 1.2 `capCandidate` для цели без направления: `base = end`, `point = end + out · newHalf` (толщина НОВОЙ стены); `faceCandidate` и `rayCandidates`: `base = point`, точка луча у торца не меняется (design D1, D4-proposal; spec «Привязка к существующим стенам», «Прилипание конца при заданном направлении»; тесты CV-START-1, CV-THICK-1, CV-CAP-A, CV-SLANT-1, CV-CONT-1, CV-RAY-*, CE-CAP-1, SNAP-CHAIN-3, RAY-CAP-*)
- [x] 1.3 Неналожение в `acceptor` и квадрат `placementSquare` строить от `base` (`snap.base ?? snap.point`); `chainEndSquare` сравнивает конец с вершиной `snap.point` (design D2; spec «Квадрат не налагается на тела стен»; тесты CV-SQ-1, CV-OVL-1, CV-END-1, CV-END-PERP, GS-09, скан-тесты wall-snap-scenes)
- [x] 1.4 `nearest` ранжирует кандидатов по `dist(p, c.base)`; зоны торца (`reach`, полоса) по-прежнему от плоскости торца (design D3; spec «Детерминированность привязки»; тесты CV-RANK-1, CV-REACH-1..3, CV-BAND-1, CAP-REACH-*, SNAP-END-3, SNAP-SCALE-*)
- [x] 1.5 Убедиться, что расширенная ветка `snapStartVertex` получает ту же цель торца (тесты CV-GRID-1, GS-04, GS-17)

## 2. Опора начала и трекинг

- [x] 2.1 `StartRef` (`src/wall-angle.ts`): необязательное поле `anchor?: Point`; `startRefOf` заполняет его из `snap.base` для `target === "cap"` (design D4)
- [x] 2.2 `trackingNodes(walls, start, exclude?)` (`src/wall-tracking.ts`) отбрасывает узел, совпадающий с `exclude`; `chainSegment` (`src/wall-chain.ts`) передаёт `ref.anchor` при `ref?.kind === "cap"` (design D5; spec «Трекинг по узлам чертежа»; тесты CV-TRK-1, CV-TRK-FAR, CV-TRK-CTRL, CV-TRK-FACE, TRK-RAY-PAR-2)
- [x] 2.3 Введённая длина и угол отсчитываются от вершины-начала без изменений в `chainSegment` (тесты CV-LEN-1, CV-JOINT-90, CV-JOINT-180, CV-JOINT-SWEEP, CH-CAP-1)

## 3. Проверка

- [x] 3.1 Утверждённые тесты изменения: `npx vitest run src/wall-snap-cap-vertex.test.ts` и пересмотренные файлы — все зелёные; файлы тестов не изменены
- [x] 3.2 Полный набор `npm test` — без падений (658 тестов)
- [x] 3.3 Проверка типов `npx tsc --noEmit` — без ошибок (линтера, форматтера и мутационного инструмента в проекте нет — отметить в отчёте)
- [x] 3.4 Ручная проверка в браузере (перезапустить dev-сервер, открыть `/draw-repair/`): вертикальная стена 20 см, квадрат у торца → клик → поворот на 90° (орто вкл. и выкл.) — стена растёт из показанного квадрата, без наложения; продолжение по оси; непрямой угол — без выемок; при отдалённом виде стена не перекашивается трекингом; орто-луч в торец — конец в плоскости торца
- [x] 3.5 `openspec validate cap-snap-vertex-at-square-center` и просмотр итогового `git diff` на случайные изменения
