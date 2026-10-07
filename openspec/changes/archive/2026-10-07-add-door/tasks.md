Тесты одобрены (`test-validation.md`, ревизия 2: `VERDICT: PASS`). Задачи меняют только продакшн-код. Одобренные тесты (`src/doorway/door-*.test.ts`, `door.test-utils.ts`, `openings-group.test.ts`) и существующие тесты не меняются. Если тест кажется неверным, реализация останавливается и оформляется test-change-request.

## 1. Модель двери и параметры вида

- [x] 1.1 `src/types.ts`: `WallDoor { kind: "door"; …; hinge: "a" | "b"; swing: "left" | "right" }`, `WallElement = Doorway | WallWindow | WallDoor`, предикат `isDoor` (design D1; spec door «Дверь — элемент стены»).
- [x] 1.2 `src/doorway/element-kind.ts`: `ElementKind` с `"door"`, `elementDefaults("door")` = 90/210, `a`/`left`, `acceptField("door", …)` как у проёма, `nextDirection` по таблице поворота (design D4; spec door «Инструмент «Дверь»», «Поворот двери»). Тесты: DK-01…DK-03c (`src/doorway/door-kind.test.ts`).

## 2. Установка и правка двери

- [x] 2.1 `src/doorway/doorway-edit.ts`: `placeDoor(host, walls, cursor, width, height, hinge, swing, id, elements)` по образцу `placeWindow`; `rotateDoor(d)` — всегда `applied` со следующим направлением; `result()` учитывает `hinge`/`swing` при сравнении «без изменений» (design D2; spec door «Дверь — элемент стены», «Поворот двери»; doorway «Элементы стены»). Тесты: DE-01…DE-07b (`src/doorway/door-edit.test.ts`).

## 3. Геометрия обозначения

- [x] 3.1 `src/doorway/doorway-layout.ts`: `doorLeaf(d, walls): DoorLeaf | null` — петля на грани стороны открывания, полотно 4 см под 95° вне сектора, дуга радиусом w от закрытого положения (design D3; spec door «Отображение двери»). Сторона `left` = `Side −1`. Тесты: DG-01…DG-11 (`src/doorway/door-leaf.test.ts`), DE-04.

## 4. Хранение и история

- [x] 4.1 `src/storage.ts`: `isWallDoor` (общие поля + `hinge ∈ {a,b}`, `swing ∈ {left,right}`), `isWallElement` с дверью, `normalizeElement` копирует поля двери (design D7; spec drawing-storage «Формат документа»). Тесты: DS-01…DS-04 (`src/doorway/door-storage.test.ts`).
- [x] 4.2 `src/history.ts`: проверка снимка через тот же `isWallElement`. Поворот — отменяемый шаг через `record` (spec drawing-history «Отменяемые действия», «Персистентность истории»). Тесты: DH-01…DH-03b; регрессия: `src/doorway/window-storage.test.ts`, `src/storage.test.ts`, `src/history.test.ts`.

## 5. Инструмент «Дверь»

- [x] 5.1 `src/doorway/doorway-tool.ts`: вид `"door"` в `createElementTool`, `kindOf` по трём видам, призрак через `placeDoor` с текущими `hinge`/`swing`, `ElementPanel.rotate`. Кнопка «Повернуть»: при одной выделенной двери — `apply(d, rotateDoor(d))` (одна запись), иначе меняет параметры новых дверей без записи. Поля выделенной двери меняют её, а не параметры (design D5; spec door «Инструмент «Дверь»», «Поворот двери», «Панель выделенной двери»). Тесты: DT-01…DT-12 (`src/doorway/door-tool.test.ts`), DC-01…DC-03 (`src/doorway/door-scene.test.ts`); регрессия: `src/doorway/window-tool.test.ts`.

## 6. Отображение и PDF

- [x] 6.1 `src/render.ts`: ветка двери в `drawDoorways` после общей части проёма. Полотно — 4 угла `doorLeaf` линиями контура (`p.ink`, `m.contourPx`), дуга — тонкой линией (`m.hatchPx`) с центром в петле, 95° через сторону `n`. Призрак двери рисуется с полотном и дугой. Выделение — по контуру участка, без полотна (design D3; spec door «Отображение двери», «Инструмент «Дверь»»). Тесты: DR-01…DR-05 (`src/doorway/door-render.test.ts`); регрессия: `doorway-render`, `window-render`.
- [x] 6.2 `src/export/pdf.ts`: `wallsBBox` добавляет углы полотна и крайние точки дуги (`hinge + u·w`, `hinge ± n·w` в пределах пролёта). Отрисовка в PDF — через общий `drawScene` (design D8; spec pdf-export «Двери в PDF»). Тесты: DP-01…DP-03 (`src/doorway/door-pdf.test.ts`); регрессия: `doorway-pdf`, `window-pdf`, `src/export/pdf.test.ts`.

## 7. Группа «Проёмы»

- [x] 7.1 `src/doorway/openings-group.ts`: `GroupState`, `groupButtonClick`, `groupPick`, `groupSelect`, `groupButtonActive` — чистые переходы без DOM (design D6; spec canvas-app «Группа «Проёмы»»). Тесты: GR-01…GR-08 (`src/doorway/openings-group.test.ts`).
- [x] 7.2 `index.html`, `src/style.css`: кнопка `#tool-openings` с новой SVG-иконкой (вид сбоку, `currentColor`) вместо `#tool-doorway` на панели. В её якоре — `#openings-panel` с рядом кнопок `#tool-doorway` (прежняя иконка проёма) и `#tool-door` (новая иконка двери), блоками полей проёма и двери, кнопкой `#door-rotate`. Стиль активной кнопки — как у `.wall-type.active`. `#tool-window` идёт сразу после группы (spec canvas-app «Группы инструментов»; window «Инструмент «Окно»»; `.claude/rules/ui.md`). Тесты: GR-09, GR-09b, GR-10.
- [x] 7.3 `src/main.ts`: `Tool` с `"door"`; второй экземпляр `createElementTool("door", …)` на общей панели группы; хранение `GroupState` и применение переходов. Также:
  - кнопка группы и кнопки в панели;
  - `setElementPanel` по виду одиночного выделения (окно → панель «Окно», проём/дверь → `groupSelect`) вместо `setDoorwayPanel`;
  - видимость блоков полей и классы `active`;
  - Esc деактивирует инструмент «Дверь»;
  - `placingTool` для `"door"`.

  Логика остаётся в `openings-group.ts` и `doorway-tool.ts` (design D6). Проверки: M-01…M-06 из test-plan.

## 8. Проверка

- [x] 8.1 Одобренные тесты: `npx vitest run src/doorway/door- src/doorway/openings-group` — всё зелёное, файлы тестов не изменены (`git diff --stat` по тестам пуст).
- [x] 8.2 Полный набор `npx vitest run`, типы `npx tsc --noEmit`, сборка `npm run build`. Линтера и форматтера в проекте нет (нет конфигурации и скриптов) — отметить в отчёте. Мутационное тестирование не настроено. Критичные мутации проверены валидатором вручную (`test-validation.md`).
- [x] 8.3 Ручные проверки M-01…M-07 в браузере: dev-сервер перезапустить, приложение на `/draw-repair/`. Иконки группы и двери, панель группы, призрак и поворот, отмена поворота, Esc, PDF с дверью.
- [x] 8.4 `openspec validate add-door`, сверка реализации со спецификациями (`/opsx:verify`), обзор итогового diff на случайные изменения. Остатки — в `TODO.md`.
