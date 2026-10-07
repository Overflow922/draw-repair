## 1. Выбор цели нажатия

- [x] 1.1 Добавить в `src/doorway/doorway-scene.ts` тип `PressPick`, `PressOptions` и функцию `pressPick` (design D1):
  порядок конец `a` → конец `b` → середина → размер → элемент стены → тело стены → `null`; попадания через
  `endpointAt`, `midpointAt`, `dimHitDistance`, `hitDoorway`, `hitWall`; опции `middleMarker`, `dimensions`,
  `elements` отключают только свою цель. Spec: wall-selection «Приоритет маркеров выделенной стены», doorway
  «Перемещение проёма». Тесты: PP-01…PP-26 (`src/doorway/press-pick.test.ts`).
- [x] 1.2 Прогнать `npx vitest run src/doorway/press-pick.test.ts src/geometry.test.ts` — все тесты проходят.

## 2. Маршрутизация в main.ts

- [x] 2.1 Перевести `pointerdown` в `src/main.ts` на `pressPick` (design D2): опции по инструменту
  (`middleMarker` — не ластик и не «Проём»/«Окно»; `dimensions` — не ластик; `elements` — не ластик, без цепочки,
  не «Размер»), `selectedWall` — одиночная выделенная стена; `switch` по `kind`, при ластике — только `end`.
  Убрать встроенные проверки маркеров, размера, элемента и стены. Spec: wall-selection «Приоритет маркеров
  выделенной стены». Тесты: PP-01…PP-26 (функция), маршрутизация — ручная проверка 3.3.

## 3. Проверка

- [x] 3.1 Approved-тесты: `npx vitest run src/doorway/press-pick.test.ts src/geometry.test.ts`.
- [x] 3.2 Полный набор `npx vitest run`, проверка типов `npx tsc --noEmit`; линтера и мутационного инструмента в
  проекте нет (мутационный анализ выполнен валидатором вручную, `test-validation.md`).
- [x] 3.3 Ручная проверка в браузере (`/draw-repair/`): средний маркер над проёмом и над окном перемещает стену;
  нажатие на проём вне маркеров тащит проём; при двух выделенных стенах нажатие в середине над проёмом тащит
  проём; в инструменте «Проём» средний маркер стену не перемещает; ластик по-прежнему удаляет кликом.
- [x] 3.4 `openspec validate fix-midpoint-marker-priority`, просмотр итогового `git diff`.
