Approved tests (read-only during implementation): `src/doorway/doorway-faces.test.ts` (DF-*), `src/doorway/doorway-edit.test.ts` (DE-*), `src/doorway/doorway-guard.test.ts` (DG-*, DD-*), `src/doorway/doorway-scene.test.ts` (DX-*), `src/doorway/doorway-render.test.ts` (DL-*, DR-*), `src/doorway/doorway-pdf.test.ts` (DP-*), `src/doorway/doorway-storage.test.ts` (DS-*, DH-*), helper `src/doorway/doorway.test-utils.ts`, plus all existing tests (incl. `storage.test.ts` roundtrip, `history.test.ts`, `wall-edit*.test.ts`, `wall-collision*.test.ts`, `wall-snap*.test.ts`, `room-area*.test.ts`, `theme-pdf.test.ts`). test-validation.md, third round — `VERDICT: PASS`. If an approved test looks wrong — stop and write `test-change-request.md` (CLAUDE.md Rule 5).

## 1. Модель и хранение

- [x] 1.1 `src/types.ts`: тип `Doorway { id, wallId, anchor: "a" | "b", offsetCm, widthCm, heightCm }`; `Drawing.doorways?: Doorway[]` — необязательное, отсутствие = пустой список (design D1, D9). Спека: doorway «Проём и опорная стена». Тесты: компиляция всех `src/doorway/*.test.ts`.
- [x] 1.2 `src/storage.ts`: валидатор `isDoorway` (строковые `id`/`wallId`, `anchor ∈ {a, b}`, конечные числа, `width > 0`, `height > 0`, `offset ≥ 0`); фильтр битых и сирот при загрузке; не массив — пустой список; поле не дописывается, если его не было (design D9). Спека: drawing-storage «Формат документа». Тесты: DS-01…DS-06; регрессия `storage.test.ts`.
- [x] 1.3 `src/history.ts`: `Scene.doorways?` и запись `kind: "walls"` с `doorways?`; `cloneScene`, `record`, `undoEntry`/`redoEntry`, сериализация и разбор с проёмами; снимок без поля — пустой список (design D9). Спека: drawing-history «Персистентность истории». Тесты: DH-01…DH-04; регрессия `history.test.ts`.

## 2. Геометрия граней (домен)

- [x] 2.1 `src/doorway/doorway-faces.ts`: `jambsT` по привязке (design D1). Тесты: DF-01, DF-02, DF-02b.
- [x] 2.2 `faceRuns(host, walls, side)` — пробные линии `s·(h ∓ ε)`, ε = 0.05: внутренняя покрыта объединением `displayPolygons` всех стен, наружная не покрыта ни одной (design D3). Тесты: DF-RUNS-1, DF-RUNS-2.
- [x] 2.3 `doorwayDistances` (plus = нормаль `(−d.y, d.x)`), отрицательные расстояния для нарушенных проёмов, `null` для сирот; `doorwayHolds` — оба откоса в одном участке на обеих гранях с допуском 1e-6. Спека: doorway «Стыки грани и расстояния», «Инвариант размещения». Тесты: DF-03…DF-11, DF-SUM, DF-NULL.

## 3. Операции над проёмом (домен)

- [x] 3.1 `src/doorway/doorway-edit.ts`: тип `DoorwayEdit`; `placeDoorway` — центр в проекции курсора с округлением до 1 см, ближайшее допустимое положение по пересечению участков обеих граней на всей стене, сторона привязки по ближнему концу (равенство — `a`) (design D4). Спека: doorway «Установка проёма». Тесты: DE-01…DE-05b.
- [x] 3.2 `setDistance` (смена привязки на сторону ввода, ограничение участком текущего положения по обеим граням), `setWidth` (неподвижен откос привязки), `setHeight`; валидация ввода и `no-change`; чистые функции. Спека: doorway «Ввод чисел размеров проёма», «Выделение проёма». Тесты: DE-06…DE-11b, DE-09d, DE-HEIGHT, DE-PURE.
- [x] 3.3 `slideDoorway` (проекция мирового вектора на ось, округление offset до 1 см, путь по оси без перепрыгивания стыков) и `arrowSlide` (шаг вдоль оси в сторону острого угла, допуск прямого угла 0.5°). Спека: doorway «Перемещение проёма». Тесты: DE-12…DE-18b, DE-14b.

## 4. Ограничение правок и рисования стен

- [x] 4.1 `src/doorway/doorway-guard.ts`: проверка позиций стен по инварианту для проёмов на изменённых стенах и их соседях; для уже нарушенных проёмов — «не углублять» по каждому проёму отдельно; `thicknessAllowed`; `violatesDoorways(before, after, doorways)` (design D5, D6). Спека: wall-collision «Правки стен не нарушают проёмы», doorway «Инвариант размещения». Тесты: DG-07, DG-07b, DG-07c, DD-02, DD-04, DD-06, DD-06b.
- [x] 4.2 `src/wall-edit.ts`: `EditMode.doorways?`; проверка проёмов в `verdictAt` как недопустимость без нормали (на каждом шаге пути — без перепрыгивания); без проёмов поведение прежнее (design D5). Тесты: DG-01…DG-06, DG-08…DG-15, DG-04b; регрессия `wall-edit*.test.ts`, `wall-collision*.test.ts`.
- [x] 4.3 `src/wall-chain.ts` / `src/wall-snap.ts`: `ChainInput.doorways?`, `snapStartVertex(..., doorways?)` — кандидаты привязки к стене, нарушающие проём, отбрасываются в `snapVertex` и `snapOnRay`; сетка и трекинг без изменений; детерминированность сохраняется (design D6). Спека: wall-drawing «Стык не создаётся внутри проёма». Тесты: DD-01, DD-01b, DD-01c, DD-03, DD-05, DD-05b, DD-06; регрессия `wall-snap*.test.ts`, `wall-chain.test.ts`.

## 5. Выбор и удаление (домен)

- [x] 5.1 `src/doorway/doorway-scene.ts`: `hitDoorway` (участок между откосами с радиусом), `doorwaysInRect` (участок оси между откосами), `wallsInRect` (ось вне участков проёмов или стена целиком в рамке), `erasePick` (размер → проём → стена) (design D2, D8). Спека: doorway «Выделение проёма», «Удаление проёма»; multi-selection «Рамка выделения»; wall-deletion «Инструмент «Ластик»». Тесты: DX-01…DX-03, DX-07…DX-09e.
- [x] 5.2 `deleteObjects` — каскад размеров и проёмов удаляемых стен, выделенные размеры и проёмы, без мутации входа. Спека: wall-deletion «Удаление выделенной стены клавишей Delete». Тесты: DX-04…DX-06c.

## 6. Отображение

- [x] 6.1 `src/doorway/doorway-layout.ts`: вырез выпуклых кусков `displayPolygons` полуплоскостями по откосам с обрезкой по участку грани (нарушенный проём не рисуется за гранью), контур без граней в проёме плюс откосы, тонкие серые продолжения граней (design D2). Спека: doorway «Отображение проёма», «Инвариант» (нарушенный). Тесты: DL-01, DL-02, DL-02b, DL-13, DL-09.
- [x] 6.2 Цепочки размеров по граням (a | ширина | b, снаружи тела со стороны грани, «0» у откоса без линии), подпись «H=…» (сторона помещения по `findRooms`, иначе слева на экране — нормаль `(d.y, −d.x)`; формат как числа размеров; шрифт не масштабируется) (design D7, D10). Тесты: DL-03…DL-03f, DL-04, DL-04b, DL-05…DL-08, DL-10.
- [x] 6.3 `src/render.ts`: `RenderOptions.doorways`, `selectedDoorways`, `doorwayGhost`, `marqueeHits.doorways?`; вырез и контур в `drawWall`, обводка выделения (`selection`) и рамки (`marqueeWall`) по участку проёма, размеры только при одиночном выделении или призраке. Тесты: DL-12…DL-12c, DR-01, DR-02; регрессия `room-area-render.test.ts`, `theme-render.test.ts`, `ruler-*.test.ts`.
- [x] 6.4 `src/export/pdf.ts`: `buildPdf(..., doorways)` передаёт проёмы без выделения и призрака; `wallsBBox(..., doorways?)` учитывает прямоугольник подписи H; `exportDrawing` — тоже. Спека: pdf-export «Проёмы в PDF». Тесты: DP-01…DP-03; регрессия `theme-pdf.test.ts`.

## 7. Проводка в приложении

- [x] 7.1 `index.html`, `src/style.css`: кнопка «Проём» после «Размер» и вспомогательная панель «Ширина» / «H» в текущих единицах (900 / 2100 мм по умолчанию). Спека: doorway «Инструмент «Проём»». Ручные: M-01, M-02.
- [x] 7.2 `src/doorway/doorway-tool.ts` (адаптер DOM): состояние инструмента, призрак под курсором, клик — установка с выделением и записью истории; клик по существующему проёму — выделение; активация прерывает цепочку и размещение размера, Esc без выделения деактивирует. `main.ts` — только маршрутизация событий. Ручные: M-03, M-04, M-16.
- [x] 7.3 Поле ввода на месте числа: клик по числу выделенного проёма, Enter → `setDistance`/`setWidth` → запись истории, Esc / потеря фокуса — закрыть без изменений; число показывает фактическое значение. Ручные: M-05, M-06.
- [x] 7.4 Выделение: набор выделенных проёмов в `main.ts`; клик по проёму во всех инструментах, кроме ластика и «Размера»; рамка через `doorwaysInRect` / `wallsInRect`; сворачивание выделения; панель «Проём» показывает и меняет ширину/высоту выделенного (одна запись истории на изменение). Ручные: M-07, M-09.
- [x] 7.5 Перетаскивание проёма (снимок жеста + `slideDoorway`, одна запись истории), стрелки для выделения без стен (`arrowSlide`, серия — одна запись). Ручные: M-10.
- [x] 7.6 Delete и ластик через `erasePick` / `deleteObjects` с подсветкой проёма красным; каскад при удалении стен. Ручные: M-08.
- [x] 7.7 Правки стен: `doorways` в `EditMode` для перемещения, конца, стрелок, ввода длины; изменение толщины через `thicknessAllowed` (при отказе поле показывает фактическую толщину); фиксация стены кликом/Enter через `violatesDoorways(before, after, doorways)`; `doorways` в `chainSegment` и `snapStartVertex`. Ручные: M-11, M-14, M-15.
- [x] 7.8 Хранение и история в `main.ts`: проёмы в снимках `pushRecord`, undo/redo, автосохранение, экспорт PDF с проёмами. Ручные: M-12, M-13.

## 8. Проверка

- [x] 8.1 Одобренные тесты: `npx vitest run src/doorway` — все зелёные без изменения тестов.
- [x] 8.2 Полный набор `npm test` и `npx tsc --noEmit`. Форматтер и линтер в проекте не настроены.
- [x] 8.3 Ручные мутации ключевых ветвей (знак ε пробных линий, `≤`/`<` на d = 0, проверка только конечного положения, ограничение одной гранью, «не углублять» как «разрешить всё», приоритет ластика, вырез в каноническую форму) — должны падать тесты; инструмента мутационного тестирования нет.
- [x] 8.4 Браузерные проверки M-01…M-16 (Firefox DevTools, /draw-repair/ после перезапуска dev-сервера; localStorage сохранить и восстановить). Замер отзывчивости правок стен с проёмами на чертеже ~100 стен (design Risks).
- [x] 8.5 `openspec validate add-doorway`, ревью диффа: одобренные тесты `src/doorway/*.test.ts` и `doorway.test-utils.ts` не тронуты, лишних изменений нет; открытые вопросы design (отступы подписи и цепочек, поле ввода при зуме) решены или записаны в TODO.md.
