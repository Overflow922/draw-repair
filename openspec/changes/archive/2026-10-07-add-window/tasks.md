Approved tests (read-only during implementation):
- new: `src/doorway/window-faces.test.ts` (WF-*), `window-edit.test.ts` (WE-*), `window-guard.test.ts` (WG-*), `window-scene.test.ts` (WC-*), `window-render.test.ts` (WL-*), `window-pdf.test.ts` (WP-*), `window-storage.test.ts` (WS-*), `window-tool.test.ts` (WTL-*), `element-kind.test.ts` (WT-*), helper `window.test-utils.ts`;
- previous: all `add-doorway` tests (`src/doorway/doorway-*.test.ts`, `doorway.test-utils.ts`) and every other existing test.

test-validation.md, revision 4: `VERDICT: PASS`. If an approved test looks wrong, stop and write `test-change-request.md` (CLAUDE.md Rule 5).

## 1. Модель, хранение, история

- [x] 1.1 `src/types.ts`: `Doorway.kind?: "doorway"`, `WallWindow { kind: "window"; …; sillCm }`, `WallElement = Doorway | WallWindow`; `Drawing.doorways?: WallElement[]`; предикат `isWindow` (design D1). Спека: doorway «Элементы стены», window «Окно — элемент стены». Тесты: компиляция всех тестов `src/doorway/`.
- [x] 1.2 `src/storage.ts`: валидатор элемента — проём (без `kind` или `"doorway"`, прежние правила) или окно (`kind: "window"`, конечный `sillCm ≥ 0`); неизвестный вид отбрасывается; нормализация копирует `kind`/`sillCm` только у окна; проём пишется без `kind` (design D7). Спека: drawing-storage «Формат документа». Тесты: WS-01…WS-04, DS-*; регрессия `storage.test.ts`.
- [x] 1.3 `src/history.ts`: `Scene.doorways?: WallElement[]`, проверка элементов снимка тем же валидатором (битый — нарушение структуры). Спека: drawing-history «Персистентность истории». Тесты: WS-05…WS-08, DH-*; регрессия `history.test.ts`.

## 2. Соседи как стыки граней (домен)

- [x] 2.1 `src/doorway/doorway-faces.ts`: `elementRuns(host, walls, elements, side, self)` = `faceRuns` минус участки других элементов этой стены (по `wallId` и `id`); `doorwayDistances` / `doorwayViolation` / `doorwayHolds` с необязательным `elements = []` (design D2). Спека: doorway «Стыки грани и расстояния проёма», «Инвариант размещения проёма». Тесты: WF-01…WF-07c; регрессия DF-*.

## 3. Операции над элементами (домен)

- [x] 3.1 `src/doorway/doorway-edit.ts`: работа с `WallElement` (вид и данные вида сохраняются), `freeIntervals` по `elementRuns`, `ElementEdit<E>` / `DoorwayEdit`; `placeDoorway(..., elements = [])`, `placeWindow`; `setDistance`, `setWidth`, `slideDoorway`, `arrowSlide` с `elements = []` (design D3). Тесты: WE-01…WE-09b, WE-13; регрессия DE-*.
- [x] 3.2 Уже нарушенный элемент: допустимый диапазон сдвига расширяется до текущего положения (design D3). Тесты: WE-07, WE-08.
- [x] 3.3 `setSill` (`≥ 0`, конечное; то же значение — `no-change`) и `nudgeElements(selected, walls, elements, arrow, step)` — ведущий первым, с обновлённым списком, весь список в исходном порядке (design D3). Тесты: WE-10, WE-12…WE-12d.
- [x] 3.4 `src/doorway/element-kind.ts`: `elementDefaults(kind)`, `acceptField(kind, field, cm)` (design D4). Спека: window «Инструмент «Окно»». Тесты: WT-01…WT-02c.

## 4. Ограничение правок и рисования стен

- [x] 4.1 `src/doorway/doorway-guard.ts`: нарушения «до» и «после» считаются со списком элементов (соседи), для правок стен, толщины и рисования (design D8). Спека: wall-collision «Правки стен не нарушают проёмы». Тесты: WG-01…WG-08, WG-07c; регрессия DG-*, DD-*.

## 5. Отображение и PDF

- [x] 5.1 `src/doorway/doorway-layout.ts`: `windowLines(w, walls, elements)` — грани контуром, откосы, квадраты 0.6·T у откосов по центру толщины, стёкла на ±T/6 от квадрата до квадрата при ширине > 1.2·T, отсечение по видимым граням; цепочки и метки чисел (`dimensionChains`, `chainLabels`, `openingLines`) со списком элементов (design D2, D5). Спека: window «Отображение окна»; doorway «Размеры выделенного проёма». Тесты: WL-01…WL-06, WL-11, WL-11b; регрессия DL-*.
- [x] 5.2 `src/theme.ts`: цвет `sill` (синий) в светлой и тёмной палитре. `src/render.ts`: выбор обозначения по виду, подпись окна «H=…» (чернила) + «H под.=…» (`sill`) в рамке цвета чернил, сторона и формат как у проёма; цепочки выделенного элемента и призрака со списком элементов (design D6). Спека: window «Подпись окна». Тесты: WL-07…WL-10; регрессия `theme-render.test.ts`, `room-area-render.test.ts`.
- [x] 5.3 `src/export/pdf.ts`: окна в PDF, `wallsBBox` учитывает ширину подписи окна (design D6). Спека: pdf-export «Окна в PDF». Тесты: WP-01…WP-03; регрессия DP-*, `theme-pdf.test.ts`, `export/pdf.test.ts`.

## 6. Инструмент и проводка в приложении

- [x] 6.1 `src/doorway/doorway-tool.ts`: `createElementTool(kind, host, panel)` по контракту design D4 (`ElementToolHost.elements()` / `selectedElements()`, `ElementPanel.sill?`, поле по `change`); все операции с `host.elements()`, стрелки через `nudgeElements`; параметры новых элементов из `elementDefaults` с проверкой `acceptField`. Спека: window «Инструмент «Окно»», «Панель выделенного окна». Тесты: WTL-01…WTL-10b.
- [x] 6.2 `src/doorway/doorway-scene.ts`: типы `WallElement` в попадании, рамке, ластике, каскаде. Тесты: WC-01…WC-06; регрессия DX-*.
- [x] 6.3 `index.html`, `src/style.css`: кнопка «Окно» после «Проём», панель «Ширина» / «H» / «H под.». `src/main.ts`: второй экземпляр инструмента, хост с `elements()` / `selectedElements()`, выделение элемента открывает панель его вида, активация инструмента прерывает цепочку и размещение размера, Esc без выделения деактивирует, все вызовы guard/edit/render/PDF получают список элементов. Ручные: M-01…M-07.

## 7. Проверка

- [x] 7.1 Одобренные тесты: `npx vitest run src/doorway` — все зелёные без изменения тестов.
- [x] 7.2 Полный набор `npm test` и `npx tsc --noEmit`. Форматтер и линтер в проекте не настроены.
- [x] 7.3 Ручные мутации ключевых ветвей (сосед — сам элемент, соседи со всех стен, одна грань, вызов без `elements`, порядок `nudgeElements`, `≥`/`>` у подоконника и стёкол) — должны падать тесты; инструмента мутационного тестирования нет.
- [x] 7.4 Браузерные проверки M-01…M-07 (Firefox DevTools, /draw-repair/ после перезапуска dev-сервера; localStorage сохранить и восстановить).
- [x] 7.5 `openspec validate add-window`, ревью диффа: одобренные тесты не тронуты, лишних изменений нет; открытые вопросы design (скругление и отступы рамки подписи) решены или записаны в TODO.md.

## 8. Подписи параллельно стене (изменение спецификации, 2026-10-06)

- [x] 8.1 `src/render.ts`: подписи проёма и окна в повёрнутой системе (`translate` + `rotate`), направление вдоль оси без переворота (вертикаль — допуск `RIGHT_SIN`, снизу вверх), рамка окна в той же системе; центр отодвигается от грани на полосу цепочек плюс половину высоты подписи (design D6 «Ориентация подписи»). Спека: doorway «Отображение проёма», window «Подпись окна». Тесты: LO-01…LO-08; регрессия DL-03*, WL-07…WL-09.
- [x] 8.2 `src/export/pdf.ts`: `wallsBBox` — повёрнутый прямоугольник подписи окна. Спека: pdf-export «Окна в PDF». Тесты: LO-09, WP-03, DP-03.
- [x] 8.3 Проверка: `npx vitest run`, `npx tsc --noEmit`, браузер (наклонная и вертикальная стена), экспорт PDF с повёрнутой подписью.

## 9. Подпись проёма в рамке (изменение спецификации, 2026-10-06)

- [x] 9.1 `src/render.ts`: рамка у подписи проёма тем же стилем, что у окна (`p.ink`, `m.hatchPx`, поле `LABEL_FRAME_PAD`), текст одной части — по центру; отступ от грани учитывает поле рамки (design D6 «Рамка у подписи проёма»). Спека: doorway «Отображение проёма», pdf-export «Проёмы в PDF». Тесты: LF-01…LF-04; регрессия DL-03*, DP-*, WL-*, LO-*.
- [x] 9.2 Проверка: `npx vitest run`, `npx tsc --noEmit`, браузер.
