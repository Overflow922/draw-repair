## 1. Цель нажатия в чистой функции

- [x] 1.1 В `src/doorway/doorway-scene.ts` добавить в `PressPick` вариант `{ kind: "communication"; communication }` и необязательный шестой аргумент `pressPick`: `communications?: { items: readonly Communication[]; tolCm: number }` (design D1, D2). Порядок: маркеры выделенной стены → размер → коммуникация (`hitCommunication` с `tolCm`) → проём → стена. Спек: `dimension-selection` «Нажатие по размеру главнее тела коммуникации». Тесты: DP-01, DP-02, DP-04, DP-06, DP-06b, DP-07, DP-07b, DP-08, DP-08b, DP-09, DP-10, DP-11, DP-12 в `src/doorway/press-pick-communications.test.ts`; `press-pick.test.ts` остаётся зелёным. Тесты не менять.

## 2. Подключение в main.ts

- [x] 2.1 В обработчике `pointerdown` (`src/main.ts`, нажатие без инструмента) передавать в `pressPick` `{ items: communicationsOf(), tolCm: BODY_HIT_PX / k() }`, только если `communicationsEditable()`; на планах «Демонтаж» и «Монтаж» не передавать. Спек: `communications` «Коммуникации на всех планах».
- [x] 2.2 На результат `kind: "communication"` вызывать `communicationTool.pressBody(p)` (выделение и начало перетаскивания, `suppressClick`, захват указателя); убрать прямой вызов `pressBody` перед `switch`. `selectionEditing.pressNumber/pressZone` и `communicationTool.pressNumber` остаются до `pressPick` (design D3). Фильтр «только чтение» не должен отбрасывать цель-коммуникацию. Спек: `communications` «Выделение, перемещение и удаление коммуникации».
- [x] 2.3 Проверить, что ластик (`erasePick`, ~817) по-прежнему выбирает размер раньше коммуникации; без правок, если так (DP-05).

## 3. Проверка и остатки

- [x] 3.1 Ручная проверка в браузере (сервер на `/draw-repair/`, перезапустить перед проверкой): (a) нажатие по линии и числу размера над воздуховодом и над стояком выделяет размер, перетаскивание меняет только вынос; (b) свободная часть того же воздуховода выделяется и перетаскивается; (c) на «Демонтаже» и «Монтаже» воздуховод не выделяется; (d) при ластике и других инструментах поведение прежнее; (e) число выделенной коммуникации, лежащее на размере, открывает правку; (f) комната, нарисованная по стенам, с воздуховодом под размером — те же результаты. Подмена чертежа через localStorage с бэкапом drawing и history, после проверки вернуть.
- [x] 3.2 Записать в `TODO.md` под заголовком `fix-dimension-press-priority (2026-10-13)`, раздел «Out of scope»: допуск размера (радиус привязки) намного больше допуска коммуникации, у малого стояка линия размера может закрыть почти всё тело; файл `src/main.ts`, `src/doorway/doorway-scene.ts`.

## 4. Итоговая проверка

- [x] 4.1 Формат, lint, `npx tsc --noEmit`, полный `npx vitest run` (включая одобренные тесты `press-pick-communications.test.ts` и `press-pick.test.ts`), `openspec validate fix-dimension-press-priority`, затем `/opsx:verify`; мутационное тестирование — если в проекте настроено (иначе зафиксировать как не настроенное). Просмотр итогового `git diff`: нет отладочного кода и лишних правок.
