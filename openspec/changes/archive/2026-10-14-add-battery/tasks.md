## Предусловия (вне задач реализации)

- Валидация тестов (`test-validation.md`) закончилась `VERDICT: FAIL` (раунд 2). Реализация начата по решению пользователя (перед `tasks` он прямо согласился начать без раунда 3). Замечания раунда 2 исправлены в тестах (`test-suite.md`, «Что исправлено после валидации»), но новый вердикт не получен. Если реализация покажет тест, который нельзя выполнить по спеке, — остановиться и оформить test-change-request (Rule 5), а не править тест.
- Одобренные тесты не меняются в задачах. Шесть конфликтующих одобренных тестов описаны в `test-change-request.md`; его решение нужно до задачи 12.
- Контракт сигнатур, которого ждут тесты, — в `test-suite.md` («Контракт API»); отступать от него нельзя. Отличие от `design.md` D4: у коммуникаций вместо объекта `Obstacles` — замыкающий необязательный параметр `batteries`.
- Расположение: код батарей — каталог `src/battery/` (организация по возможности, как `doorway/`, `communications/`); в существующих модулях — только точечные расширения. `src/main.ts` получает только вызовы готовых модулей.

## 1. Типы и данные

- [x] 1.1 `src/types.ts`: `Battery`, `BatteryMark`, `BatteryCornerPoint` в `DimPoint`, `Drawing.batteries?`, `Drawing.batteryDemolition?`, `MountingContent.batteries?`; `Tool` содержит `"battery"` (`src/doorway/openings-group.ts`). Спека: `battery` «Батарея и опорная стена»; `drawing-storage` «Батареи в документе». Тесты: `battery-storage` (форма данных), типы проверяются `tsc`.
- [x] 1.2 Существующие места, ветвящиеся по `kind: "jamb"` (`cloneDimPoint` в `history.ts`, `copyDimPoint`/`isDimension` в `storage.ts`, `refsWall`/`refsElement` в `doorway-scene.ts`, `geometry.ts`, `mounting-scene.ts`), дополнить видом `corner`, не заменяя. Тесты: `battery-storage` (B-STO-7*), `battery-scene` (B-FOL-8*), `battery-mounting` (B-MNT-17*).

## 2. Геометрия и ограничение пересечений

- [x] 2.1 `src/battery/battery-geometry.ts`: `batteryRect`, `batteryCorner`, `batteryHolds` (прямоугольник от оси стены; глубина наложения > `RECOGNITION_DEPTH_CM` с другими батареями любых стен, телами чужих стен, коммуникациями; опорная стена и сама батарея не препятствия; окна, проёмы, двери не препятствия). Спека: `battery` «Батарея и опорная стена», «Размещение батареи вдоль стены»; design D1, D2. Тесты: `battery-geometry` (B-GEO-*, B-PLC-3/4/6/7/8/16, B-GRD-12..14), `battery-invariants` (B-INV-2).
- [x] 2.2 `src/battery/battery-face.ts`: `chooseFace(wall, cursor, walls)` по `findRooms`: внутренняя грань комнаты с заливкой, иначе грань ближе к курсору. Спека: `battery` «Грань установки»; design D9. Тесты: `battery-face` (B-FACE-*).

## 3. Размещение и перемещение

- [x] 3.1 `src/battery/battery-place.ts`: `DEFAULT_BATTERY_PARAMS` (70/10/3), `inheritBatteryParams`, `BatteryContext`, `BatteryEdit`. Спека: `battery` «Инструмент «Батарея» и параметры новых батарей». Тесты: `battery-place` (B-NUM-1..3).
- [x] 3.2 Допустимые интервалы вдоль оси: видимый участок грани (`faceRuns`, включая свободные торцы стены; откосы элементов не стыки), запретные интервалы от других объектов, правило существующего наложения («не углубляется»). Спека: «Размещение батареи вдоль стены»; design D3. Тесты: `battery-place` (B-PLC-1..12, 30*, 31*, 32*), `battery-invariants` (B-INV-1, 3, 4).
- [x] 3.3 `placeBattery`, `slideBattery`, `arrowSlideBattery` (округление до см, стрелки 10/1, допуск прямого угла 0,5°, привязка b, остановка в касании с допуском). Спека: «Перемещение батареи», «Инструмент «Батарея»…». Тесты: `battery-place` (B-PLC-13..15, 20..24, 40..42).
- [x] 3.4 Центровка по окну: цель — ближайшее по центру окно той же стены, радиус `ctx.snapCm`, точное положение (дробное допустимо), только при установке и перетаскивании, после ограничений; двери и проёмы не цели. Спека: `battery` «Центровка по окну». Тесты: `battery-place` (B-CTR-*).
- [x] 3.5 `src/battery/battery-edit.ts`: `batteryNumbers`, `setBatteryDistance`, `setBatteryLength`, `setBatteryThickness`, `setBatteryGap` (границы значений, ближайшее допустимое, «без изменений», рост длины от торца привязки). Спека: «Числа выделенной батареи», «Правка чисел батареи». Тесты: `battery-edit` (B-NUM-5..15).

## 4. Двустороннее ограничение

- [x] 4.1 `src/battery/battery-guard.ts`: `violatesBatteries`, `thicknessAllowedForBatteries`, `limitNewWallByBatteries`, `squareAllowedForBatteries`. Спека: `wall-collision` «Стены не налагаются на батареи». Тесты: `battery-guard` (B-GRD-0..6, 12).
- [x] 4.2 `src/wall-edit.ts`: `EditMode.batteries?` и охранник для `moveWallsBounded`, `moveEndpointBounded`, `resizeWallBounded` (остановка в касании со скольжением; батареи опорной стены едут с ней и проверяются против всех объектов; видимый участок грани остаётся вмещающим батарею; сторона привязки). Подключать рядом с `communicationGuard`, не меняя его. Тесты: `battery-guard` (B-GRD-1, 2, 2b, 5c, 8), `battery-scene` (B-FOL-5), `battery-guard` (B-FOL-11*, 12*).
- [x] 4.3 Рисование стены: подключить `limitNewWallByBatteries` и `squareAllowedForBatteries` там же, где `limitNewWall`/`squareAllowed` (`wall-snap.ts`/`main.ts` — вызовы). Тесты: `battery-guard` (B-GRD-2c..3b).
- [x] 4.4 `src/communications/placement.ts`, `src/communications/edit.ts`: замыкающий необязательный параметр `batteries` у `moveLimited`, `ghostPosition`, `applyNumber`; `communicationViolation` учитывает батареи. Спека: `communications` «Коммуникации не налагаются на батареи». Тесты: `battery-guard` (B-GRD-7..11, B-GRD-10*).

## 5. Выбор, ластик, удаление

- [x] 5.1 `src/battery/battery-pick.ts`: `hitBattery`, `batteriesInRect` (пересечение рамки с повёрнутым прямоугольником, в том числе частичное). Спека: `battery` «Удаление батареи». Тесты: `battery-scene` (B-FOL-9*, 10*).
- [x] 5.2 `src/doorway/doorway-scene.ts`: `Selection.batteries?`, `erasePick` (батарея раньше стены), `pressPick` (`PressOptions.batteries?`, ниже маркеров и размера, выше стены), `deleteObjects` (батареи, каскад со стеной, размеры на углах; без ключа `batteries`, если его не было). Тесты: `battery-scene` (B-FOL-6..8*, B-TOOL-6*).

## 6. Точки замера

- [x] 6.1 `src/geometry.ts`: `dimPointPoint`, `nearestDimAnchor` (приоритет: вершина контура, откос, угол батареи) с параметром `batteries`; `measureDimension` (проекция на ось или нормаль стены батареи первой точки, равенство — ось); `dimGeometry` с необязательным направлением измерения. Спека: `dimension-tool` «Точки замера на углах батареи»; design D5. Тесты: `battery-dimension` (B-DIM-*).
- [x] 6.2 `src/render.ts`: отрисовка размера с углом батареи использует `measureDimension`; числа на холсте равны значению; выносные линии от точек замера. Тесты: `battery-render` (B-DIM-10, 10b), `battery-pdf` (B-PDF-8).

## 7. История и хранение

- [x] 7.1 `src/history.ts`: `Scene.batteries?`, поле в записи `walls`, `cloneScene` (без поля — без ключа), `recordDemolition`/`undoDemolition`/`redoDemolition` с `{ marks, batteryMarks }` (копирование, очистка повтора, старые записи без `batteryMarks`). Тесты: `battery-storage` (B-HIS-*, B-INV-5).
- [x] 7.2 `src/storage.ts`: `isBattery` (непустые `id`, `wallId`; допустимые числа), загрузка и сохранение `batteries` (отбрасывание на отсутствующей стене), `batteryDemolition` (отбрасывание пометок на отсутствующие батареи), `mounting.batteries` (ссылки на отсутствующие стены сохраняются), точки `corner` в размерах; ключи не дописываются, когда их не было. Спека: `drawing-storage` «Батареи в документе». Тесты: `battery-storage` (B-STO-*).

## 8. План «Демонтаж» и «Монтаж»

- [x] 8.1 `src/battery/battery-demolition.ts`: `addBatteryMark`, `removeBatteryMark`, `batteryMarkAt`, `demolishedBatteries`, `liveBatteryMarks`. Спека: `demolition-plan` «Снос батареи»; design D8. Тесты: `battery-demolition` (B-DEM-*).
- [x] 8.2 `src/mounting/mounting-scene.ts`: `batteries` (старые: не помечены, участок вдоль оси не задет сносом стены, остаток есть; перенос на остаток с пересчётом привязки a/b; затем собственные), `oldBatteryIds`; размеры с углами отбрасываются, если батарея не видна. Спека: `mounting-plan` «Батареи на плане «Монтаж»»; design D7. Тесты: `battery-mounting` (B-MNT-*).

## 9. Отрисовка, PDF, панель инструментов

- [x] 9.1 `src/render.ts`, `src/battery/battery-render.ts` (если нужен): контур, секции (≈10 см, не меньше одной), пустой отступ, числа выделенной батареи по единице, ничего у мультивыделения; `RenderOptions.batteries`, `selectedBatteries`. Спека: `battery` «Отображение батареи». Тесты: `battery-render` (B-RND-1..6*, B-GEO-5).
- [x] 9.2 `src/demolition/demolition-render.ts`: подложка батарей серым, помеченные — красный контур, штриховка 135°, клип по прямоугольнику (`demolishedBatteryIds`). Тесты: `battery-render` (B-RND-7..8c).
- [x] 9.3 `src/export/pdf.ts`: `PlanPage.batteries`/`demolishedBatteryIds`, `pagesOf`, `pageBounds`, передача в `drawScene`/`drawDemolitionScene` без выделения. Спека: `pdf-export` «Батареи в PDF». Тесты: `battery-pdf` (B-PDF-*).
- [x] 9.4 `src/plans.ts`, `src/tool-mode.ts`, `index.html`: `"battery"` после `"window"` в наборах обмера и «Монтажа»; `afterPlace`; кнопка `id="tool-battery"` в якоре `data-tools="battery"`, значок 32×32, без панели. Спека: `canvas-app` «Кнопка «Батарея»». Тесты: `battery-tool` (B-TOOL-3..7). **Зависит от решения по `test-change-request.md`.**

## 10. Проводка в приложении (`src/main.ts`)

- [x] 10.1 Инструмент «Батарея»: призрак, клик ставит, выделяет и снимает инструмент, параметры новых батарей, Esc; выделение, перетаскивание, стрелки и ввод чисел через готовые модули; один шаг истории на жест; без записи при «без изменений». Спека: `battery` «Инструмент…», «Перемещение батареи», «Правка чисел батареи». DOM-проводка без автотестов (`TODO.md`): проверка вручную в браузере (задача 11.3).
- [x] 10.2 Ластик, Delete, рамка, «Демонтаж» (клик по батарее, «Ластик» снимает пометку), приоритет нажатия, подложка «Монтажа» только для чтения, инструмент на «Монтаже» с собственными батареями; история каждого плана. Спека: `battery` «Удаление батареи», «Батареи на всех планах»; `demolition-plan` «Снос батареи»; `mounting-plan`.

## 11. Проверка

- [x] 11.1 Применить решение по `test-change-request.md`: проверить, что diff затрагивает только перечисленные ожидания (задача выполняется пользователем или отдельным шагом, не реализацией).
- [x] 11.2 Запустить одобренные тесты change (`npx vitest run src/battery`), весь набор (`npx vitest run`), `npx tsc --noEmit`; lint и форматтер в проекте не настроены (`TODO.md`). Ни один тест не менялся для прохождения.
- [x] 11.3 Проверка вручную в браузере (`.claude/rules`, память о проверках): постановка батареи на внутреннюю грань комнаты; центровка по окну; перетаскивание и стрелки; ввод чисел; размеры к углам; снос и «Монтаж»; PDF; перезагрузка. Для старого сохранённого чертежа — открытие без ошибок.
- [x] 11.4 `openspec validate add-battery --strict` и `/opsx:verify`; финальный просмотр `git diff` (нет отладочного кода и мёртвого кода, нет лишних изменений); обновить `TODO.md` (убрать выполненное, оставить неразрешённое).
