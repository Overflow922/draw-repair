Одобренные тесты (test-validation: VERDICT: PASS) — `src/wall-angle.test.ts`,
`src/wall-snap-ray.test.ts`, `src/wall-chain.test.ts` и изменённые по TCR
`src/wall-geometry.test.ts`, `src/wall-snap-scenes.test.ts`, `src/geometry.test.ts`,
`src/geometry-cleanup.test.ts`. Задачи меняют только production-код; тесты не меняются.

## 1. Привязка по лучу (wall-snap.ts)

- [x] 1.1 Добавить вид примыкания `target: "face" | "cap"` в `Candidate` и неперечислимым полем в результат `snapVertex` (design D2; спека wall-drawing «Стена примыкания»; тест REF-SHAPE-1)
- [x] 1.2 Реализовать `snapOnRay(p, walls, radiusCm, gridStepCm, newThicknessCm, start, dir)`: пересечения луча с гранями (вход снаружи, открытые участки контура без сжатия) и свободными торцами (в пределах отрезка торца), зона от курсора, проверка наложения квадрата, ближайший к курсору с равенством по порядку стен, иначе сетка на луче (осевой — координата, наклонный — длина), конец не позади начала (design D3; спеки «Прилипание конца при заданном направлении», «Привязка к сетке»; тесты RAY-*, INV-RAY-1/2, RAY-PURE-1)
- [x] 1.3 Перевести ветку `orthoFrom` в `snapVertex` на `orthoDirection(null, …)` + `snapOnRay`; без сработавшего орто — прежний путь (design D4; спека «Привязка под 90 градусов»; тесты SNAP-ORTHO-WALL-1/2, SNAP-PRIO-2, SNAP-ORTHO-*, SNAP-CHAIN-*, CAP-*, CE-*, INV-CHAIN-SAME-1, INV-CHAIN-END-1)

## 2. Угол и направления (новый модуль wall-angle.ts)

- [x] 2.1 `StartRef`, `startRefOf`, `wallAngleDeg`, `angleReferenceRay` (design D1; спеки «Стена примыкания», «Угол к стене примыкания»; тесты REF-*, ANG-*, INV-ANG-1)
- [x] 2.2 `orthoDirection(ref, v)`: опорные направления торца/грани/экрана, допуск 15° включительно в форме cross/tan (design D1; спека «Привязка под 90 градусов»; тесты ORTHO-*)
- [x] 2.3 `typedDirection(ref, deg, v)` и `parseAngleDeg(text)`: диапазоны, сторона по курсору, правило разделяющей линии (design D1; спека length-input «Ввод угла»; тесты TYPED-*, PARSE-1)

## 3. Единый расчёт сегмента (новый модуль wall-chain.ts)

- [x] 3.1 `ChainInput`, `ChainSegment`, `chainSegment(input)`: введённый угол → орто → курсор; конец через `snapOnRay` или `snapVertex`; введённая длина вдоль направления; `angleDeg`/`refRay` только при опоре (design D5; спеки «Привязка под 90 градусов», «Угол к стене примыкания», length-input «Фиксация вершины по введённой длине», «Ввод угла»; тесты CH-*)

## 4. Интеграция в инструмент «Стена» (main.ts, geometry.ts)

- [x] 4.1 Хранить опору начала `chainRef` из `cursorSnap` на первом клике; сбрасывать вместе с `chainStart` (design D5; спека «Стена примыкания»)
- [x] 4.2 `snapWallCursor`, `redraw` и `commitPoint` строить по `chainSegment`; убрать `previewPoint`/`cursorV`-ветку и расхождение превью и фиксации; квадрат на конце — по `seg.snap` и `seg.dir` (design D5; спеки «Привязка под 90 градусов», length-input «Фиксация вершины по введённой длине»)
- [x] 4.3 Удалить `lockedDirection` из `src/geometry.ts` и его импорт в `main.ts` (design D5, D8)

## 5. Отображение угла (render.ts)

- [x] 5.1 `RenderOptions.angle` и отрисовка дуги (24 px экрана, сектор от `refRay` к `dir`) с подписью в целых градусах; `main.ts` заполняет `angle` только при опоре и длине превью > 0 (design D6; спека «Угол к стене примыкания»)

## 6. Поле угла (index.html, style.css, main.ts)

- [x] 6.1 Поле «Угол» с единицей «°» сразу после поля длины в блоке размеров (порядок Tab) (design D7; спека length-input «Блок размеров»)
- [x] 6.2 Активность поля только при цепочке с опорой; живое значение с выделением; ручной ввод не перезаписывается; Enter фиксирует стену; очистка при фиксации, Esc, смене инструмента (design D7; спека length-input «Ввод угла»)

## 7. Проверка

- [x] 7.1 Одобренные тесты и полный набор: `npx vitest run` — все зелёные
- [x] 7.2 Проверка типов и сборка: `npm run build` (`tsc && vite build`); форматтер и линтер в проекте не настроены — отметить
- [x] 7.3 Ручная проверка в браузере (перезапустить dev-сервер, путь `/draw-repair/`): угол у грани и торца, орто к наклонной стене, упор в противоположную стену, поле угла (Tab, активность, ввод, Enter/Esc), свободное начало без угла
- [x] 7.4 `openspec validate wall-relative-angle-snap` и финальный просмотр `git diff` (в т. ч. удаление `lockedDirection`, отсутствие отладочного кода)
