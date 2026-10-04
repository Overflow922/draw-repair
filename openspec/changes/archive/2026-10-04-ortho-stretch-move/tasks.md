Approved tests (read-only during implementation): `src/geometry-ortho-snap.test.ts` (OS-*), `src/ortho-stretch.test.ts` (ST-*), plus all existing tests (incl. `geometry.test.ts` snap / moveWalls / moveEndpoint). test-validation.md, «Third validation» — `VERDICT: PASS`.

## 1. Привязка на оси орто

- [x] 1.1 В `snap()` (`src/geometry.ts`) при `orthoFrom` сначала определять ось (отклонение ≤ 15°). На оси: кандидаты-стены — пересечение оси с линией стены (включая продолжение) и проекции концов стен на ось, ближайший к курсору в радиусе. Иначе сетка только по координате вдоль оси; координата поперёк оси — ровно от `orthoFrom`. Без оси — прежнее поведение (design D1). Спека: «Орто без боковой составляющей». Тесты: OS-1…OS-11, OS-6b, OS-INV, существующие тесты `snap`.

## 2. План орто-растяжения

- [x] 2.1 Экспортировать `RIGHT_SIN` из `src/wall-geometry.ts` и проверку T-примыкания из `src/geometry.ts` (без изменения поведения). Экспортирована покончевая `teeEndAttached` — плану нужен конкретный конец; `teeAttached` построена на ней и осталась прежней.
- [x] 2.2 Создать `src/ortho-stretch.ts`: типы `StretchSeed`, `StretchPlan`; чистая `planOrthoStretch(walls, seed, v)` — обход в ширину по design D2, шаги 1–5: связь по `faceCornerTol` и T-примыканию только от стен, сдвигаемых целиком; параллельность по `RIGHT_SIN`; стена с обоими концами — целиком и в очередь; связи по исходной геометрии. И `applyStretch(plan, v)`. Спека: «Орто-растяжение связанных стен». Тесты: ST-0…ST-19.

## 3. Проводка в приложении

- [x] 3.1 `src/main.ts`, перемещение стены и группы (`groupMove`): при `ortho` — применение от снимка жеста (design D3). Восстановить `a` / `b` стен из `groupMove.snapshot`, взять полный вектор от `baseA`, построить план по исходной геометрии с seed `walls: group`, применить. Исключить из привязки стены плана по направлению оси (D4). Без орто — как сейчас.
- [x] 3.2 `endpointDrag`: при `ortho` — от снимка, seed `end`, `v = next − base`.
- [x] 3.3 Сдвиг стрелками: при `ortho` — план с seed `walls: selectedWalls` и `v = ±step`.
- [x] 3.4 `resizeSelected` (ввод длины): при `ortho` — план с seed `end: b`, `v = newB − b`.

## 4. Проверка

- [x] 4.1 Одобренные тесты: `npx vitest run src/geometry-ortho-snap.test.ts src/ortho-stretch.test.ts` — все зелёные без изменения тестов.
- [x] 4.2 Полный набор `npm test`, `npx tsc --noEmit`. Форматтер и линтер в проекте не настроены.
- [x] 4.3 Ручные мутации ключевых ветвей (поперечное округление в `snap`, без распространения, двойной сдвиг, приваривание вместо +v) — должны падать тесты.
- [x] 4.4 Браузерные проверки E2E-1…E2E-9 из test-plan (Firefox DevTools, события указателя на холсте; localStorage сохранить и восстановить).
- [x] 4.5 `openspec validate ortho-stretch-move`, ревью диффа: изменены только `src/geometry.ts`, `src/wall-geometry.ts` (экспорт), новый `src/ortho-stretch.ts`, `src/main.ts`; тесты не тронуты.
