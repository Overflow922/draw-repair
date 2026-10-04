Approved tests (read-only during implementation): `src/wall-seam.test.ts` (SM-*), `src/wall-geometry-corner.test.ts` (SM-9 and all existing CJ-*). test-validation.md — `VERDICT: PASS`.

## 1. Канонический контур по материалу

- [x] 1.1 В `src/wall-geometry.ts` переписать `contourSegments(wall, walls)` по design D1: `outlineSegments(wall)` минус интервалы, совпадающие с `outlineSegments` соседей того же материала (`type`, толщина не сравнивается). Интервалы считаются в параметризации собственного отрезка, интервалы нулевой длины отбрасываются, видимые участки — через существующие `mergeIntervals`/`uncovered`. Спека: «Слияние стен одного материала». Тесты: SM-1…SM-6, SM-10, SM-13, SM-16, SM-ORACLE, SM-INV-1, SM-INV-3.
- [x] 1.2 Реализовать проверку совпадения отрезков по design D2: коллинеарность нормированных направлений, расстояние до прямой ≤ порядка 1e-4 см, без опоры на ориентацию рёбер. Проверка «формы по разные стороны» — через `pointInPolygon` в точках `mid ± δ·n`. Тесты: SM-15, SM-10, SM-ORACLE (обе группы), SM-7.
- [x] 1.3 Фильтр соседей-кандидатов: габарит отображаемой формы (или сырого прямоугольника, расширенный не меньше чем на толщину) — design D1, п. 2. Тесты: SM-ORACLE R+/R−/CJ-13t, SM-9, SM-14.
- [x] 1.4 Убедиться, что клин, угловой стык на грани и легаси-вершина обрабатываются тем же правилом без частных веток. Спека: «Заливка клина на непрямом угле», «Легаси-стыки совпадающих осей», «Примыкание блоков на прямом угле». Тесты: SM-8, SM-8d, SM-9, SM-14, SM-ORACLE W45/W60/R±/V-20/10/V45, существующие CJ-13, CJ-13c, CJ-13d.

## 2. Удаление частных механизмов шва

- [x] 2.1 Удалить `onSameTypeFace`, `seamLines`, `SeamLine`, `seamVisible`, `onLine` из `src/wall-geometry.ts` (design D3). `faceCornerAt`, `coveredInterval`, `mergeIntervals`, `uncovered`, `visibleEdge` сохранить. `geometry-cleanup.test.ts` не менять. Тест: SM-17.

## 3. Рендер и превью

- [x] 3.1 Проверить, что `drawScene` в `src/render.ts` рисует и зафиксированные стены, и превью со сценой `sceneWalls = [...walls, preview]` (design D4); подсветку (`outlineSegments`) не менять. Сигнатура `contourSegments` не меняется, `export/pdf.ts` не трогать. Тесты: SM-18, SM-18d, SM-11, SM-12.

## 4. Проверка

- [x] 4.1 Прогнать одобренные тесты: `npx vitest run src/wall-seam.test.ts src/wall-geometry-corner.test.ts` — все зелёные, без изменения тестов.
- [x] 4.2 Полный набор `npm test` — все зелёные (ожидается 911 тестов).
- [x] 4.3 Typecheck `npx tsc --noEmit`. Форматтер и линтер в проекте не настроены (нет скриптов в `package.json`) — зафиксировать это в отчёте, а не вводить новые.
- [x] 4.4 Мутационное тестирование не настроено. Повторить вручную ключевые мутации из test-validation.md (игнор материала, сохранение толщины, скрытие ребра целиком, асимметрия) на копии и убедиться, что они убиты.
- [x] 4.5 Визуально проверить в запущенном приложении (`/draw-repair/`) L-, T- и коллинеарный стык одного материала (включая 20/10) и разных материалов, а также превью цепочки.
- [x] 4.6 `openspec validate seamless-same-material-joints` и ревью финального диффа: изменения только в `src/wall-geometry.ts` (и при необходимости `src/render.ts`), тесты не тронуты.

## 5. Почти совпадающие участки (дополнение: обрубки шва у слегка повёрнутых стен)

Approved tests: `src/wall-seam-tilt.test.ts` (ST-0…ST-7); test-validation.md, «Amendment re-validation» — `VERDICT: PASS`.

- [x] 5.1 В `src/wall-geometry.ts` расширить проверку совпадения по design D2 (amended): угол ≤ `RIGHT_SIN` (0.5°), касание/пересечение отрезков в пределах `TOUCH_CM = 1e-3`, расхождение на интервале ≤ `MAX_GAP_CM = 0.5`. Спека: «Слияние стен одного материала», почти совпадающие участки. Тесты: ST-1, ST-5, ST-4, ST-6, ST-7, SM-15.
- [x] 5.2 Перевести проверку «по разные стороны» на нормали внутрь каждой формы: пробы в середине своей части у каждого из двух отрезков (design D2). Тесты: ST-1, ST-2, ST-3, SM-ORACLE (разные материалы).
- [x] 5.3 Прогнать `npx vitest run src/wall-seam-tilt.test.ts src/wall-seam.test.ts src/wall-geometry-corner.test.ts`, полный набор `npm test`, `npx tsc --noEmit`; ручные мутации из test-validation.md (строгая коллинеарность, без касания, без ограничения расхождения, допуск 1°); визуальная проверка повёрнутого углового стыка на грани в приложении; `openspec validate`, ревью диффа.