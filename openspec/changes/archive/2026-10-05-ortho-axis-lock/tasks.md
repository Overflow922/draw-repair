## 1. Ось жеста (design D1)

- [x] 1.1 Создать `src/ortho-axis.ts`: `type Axis = "x" | "y"`, `dominantAxis(v)` (`"x"` при `|v.x| ≥ |v.y|`, `null` для нулевого вектора), `latchAxis(current, dir)`, `onAxis(v, axis)` — spec `wall-selection` «Орто без боковой составляющей»; тесты `src/ortho-axis.test.ts` (AX-1…AX-10)

## 2. Привязка вдоль оси (design D3)

- [x] 2.1 Экспортировать из `src/geometry.ts` `snapAlongAxis(cursor, walls, gridStepCm, radiusCm, through, axis): SnapResult` поверх существующей `snapOnOrthoAxis`; `snapWithSource` и `orthoLockAxis` не менять (курсор цепочки) — тесты `src/geometry-snap-along-axis.test.ts` (SA-1…SA-7, INV-SNAP), существующие `src/geometry-ortho-snap.test.ts` остаются зелёными

## 3. Вектор правки на оси (design D5)

- [x] 3.1 В `src/tee-bounds.ts` заменить конус 15° в `orthoAxisOf` на `dominantAxis` (ось `null` только для нулевого вектора), удалить `ORTHO_TAN`; проверить `projectMove` и `projectEnd` — spec «Орто без боковой составляющей», «Изменение длины перетаскиванием конца»; тесты `src/wall-edit-ortho-axis.test.ts` (WE-1…WE-4, WE-U, WE-R2, WC-1, WE-INV, INV-NO-CASCADE, GE-4, GE-5)
- [x] 3.2 Убедиться, что `moveWallsBounded` / `moveEndpointBounded` (`src/wall-edit.ts`) при орто проецируют любой ненулевой вектор/цель на ось из п. 3.1; существующие тесты орто-правок (`wall-edit-tee`, `wall-edit-follow`, `wall-collision`, `ortho-stretch`) остаются зелёными

## 4. Шаг орто-жеста (design D2, D4)

- [x] 4.1 Создать `src/ortho-gesture.ts`: неизменяемое `OrthoGesture { kind, press, ref, axis }`, `startOrthoGesture(kind, press, ref)` (ось `null`), `orthoGestureStep(g, pointer, walls, seed, gridStepCm, radiusCm)` — защёлка только при ненулевом `pointer − press`; направляющий вектор `pointer − press` (move) / `pointer − ref` (end); пока оси нет — `target = null`; точка привязки `ref + (pointer − press)` (move) / `pointer` (end); `snapAlongAxis` через `ref` среди невырожденных стен, не попавших в `planOrthoStretch(walls, seed, единичный вектор оси)` (и увлекаемых целиком, и растягиваемых) — тесты `src/ortho-gesture-step.test.ts` (OG-1…OG-19), `src/ortho-gesture.test.ts` (GS-*, GE-*, GG-1, AX-8, AX-8b, AX-9, INV-LATCH)

## 5. Обвязка жестов в `main.ts` (design D2)

- [x] 5.1 В `src/main.ts` хранить `OrthoGesture` в `groupMove` (`startOrthoGesture("move", grab, baseA)`) и `endpointDrag` (`startOrthoGesture("end", pointer, otherEnd)`) на `pointerdown`
- [x] 5.2 На `pointermove` при орто: восстановить снимок, вызвать `orthoGestureStep` с seed `{ kind: "walls", walls: group }` (перемещение) или `{ kind: "end", wall, end }` (конец), сохранить возвращённый жест; при `target ≠ null` вызвать `moveWallsBounded(…, target.point − baseA, editMode(target))` или `moveEndpointBounded(…, target.point, editMode(target))` (если цель не совпадает с противоположным концом); без орто — прежний путь `snapWithSource` без `orthoFrom`
- [x] 5.3 Удалить `stretchSnapWalls` и вызовы `snapWithSource(…, orthoFrom)` для правок стен; курсор цепочки `toSnappedPoint` не трогать; `pointerup` и сбросы жестов удаляют состояние жеста целиком

## 6. Ручная проверка в браузере (DOM-обвязка, test-validation)

- [x] 6.1 `pointerdown` на среднем маркере, на теле стены в групповом выделении и на конце стены начинает жест без оси; второй жест после отпускания выбирает ось заново (горизонтальный жест → отпустить → вертикальный)
- [x] 6.2 `pointermove` сохраняет жест: тянуть вправо, затем вверх — стена остаётся на горизонтали; вернуть указатель в точку нажатия и вести вверх — вертикального сдвига нет
- [x] 6.3 `pointerup` и сбросы жеста (Escape, смена инструмента, отмена) очищают состояние жеста
- [x] 6.4 Конец горизонтальной стены, первый ход вверх — стена не поворачивается; первый `pointermove` в точке нажатия не выбирает ось
- [x] 6.5 Раскладка `img.png`: диагональный жест двигает только перемещаемую стену и концы её соседей; то же для группы
- [x] 6.6 Стена комнаты вне сетки при орто, сдвинутая на несколько см вдоль и поперёк себя, не прилипает к собственному стыку; конец, примыкающий к грани стены, привязывается к ней вдоль оси (риск F10/G29: seed `{ kind: "end" }` для перетаскивания конца)
- [x] 6.7 Перемещение без смещения не пишет историю; один жест — одна запись истории; при выключенном орто поведение прежнее

## 7. Проверка

- [x] 7.1 Запустить утверждённые тесты change: `npx vitest run src/ortho-axis.test.ts src/geometry-snap-along-axis.test.ts src/wall-edit-ortho-axis.test.ts src/ortho-gesture-step.test.ts src/ortho-gesture.test.ts` — все зелёные, тесты не изменены
- [x] 7.2 Полный набор `npx vitest run` — зелёный
- [x] 7.3 Проверка типов `npm run build` (`tsc` + `vite build`) — без ошибок (линтер и форматтер в проекте не настроены)
- [x] 7.4 Мутационное тестирование критичных единиц (`dominantAxis`, `latchAxis`, `orthoGestureStep`, `orthoAxisOf`) по сценарию test-validation — выживших критичных мутантов нет (инструмента мутаций в проекте нет; harness валидатора в scratchpad)
- [x] 7.5 `openspec validate ortho-axis-lock` и сверка реализации со спецификацией (`/opsx:verify`); финальный просмотр `git diff`
