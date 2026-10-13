## 1. Положение элемента у конца опорной стены (`doorway`, design D1, D2)

Утверждённые тесты: `src/doorway/opening-reach-body-end.test.ts` (T-03…T-33), регрессия — `collinear-distance*.test.ts`,
`doorway-edit.test.ts`, `doorway-faces.test.ts`, `window-edit.test.ts`, `door-edit.test.ts`. Тесты не менять.

- [x] 1.1 В `src/doorway/collinear-chain.ts` вывести из `ChainEnd` признак «у конца есть продолжение того же материала» (`limitT === null && extendCm > 0`) — именованной функцией рядом с `hostChains`, без нового типа данных (spec doorway «Расстояния проёма сквозь коллинеарные стены»; тесты T-15, T-16, T-29, T-29b).
- [x] 1.2 В `freeIntervals` (`src/doorway/doorway-edit.ts`) заменить обрезку `[0, len]` на границы по признаку 1.1: ось — только у конца с продолжением того же материала, иначе пределы задают участки граней (тесты T-11, T-12, T-13, T-14, T-16b/c, T-17, T-20, T-23, T-33).
- [x] 1.3 Проверить, что `setDistance`, `setWidth`, `shift`, `place` работают с отрицательным `offsetCm` без правок формул (`withStart`, `jambsT`); при необходимости поправить комментарий-описание «элемент не выходит за концы стены» в `doorway-edit.ts` (тесты T-11b, T-11g, T-28, T-30, T-32).

## 2. Хранилище (`drawing-storage`, design D3)

Утверждённые тесты: `src/doorway/opening-reach-body-end-storage.test.ts` (T-17…T-19, T-27, T-34, T-35), правки `DS-03`/`DS-04` по `test-change-request.md`.

- [x] 2.1 В `src/storage.ts` (`hasElementFields`) принимать любое конечное `offsetCm`, убрав условие `>= 0`; остальные проверки элемента не менять (тесты T-17, T-17c, T-17d, T-18, T-18b, T-18c, T-18d, T-27, T-34, T-35b).
- [x] 2.2 Обновить комментарий к валидатору элементов и убедиться, что история (`isHistoryEntry` в `src/history.ts`) читает элементы с отрицательным смещением через тот же валидатор (тесты T-35, T-35b).

## 3. План «Монтаж» (`mounting-plan`, design D4a)

Утверждённые тесты: `src/mounting/mounting-overhang.test.ts` (T-26…T-26n), регрессия — `src/mounting/*.test.ts` (MP-*).

- [x] 3.1 В `src/mounting/mounting-scene.ts` (`resolveOld`, `resolveOwn`) расширить проверку «целиком на остатке»: у остатка, чей конец совпадает с концом исходной стены, граница — реальное тело стены (участок грани опорной стены, `openingFaceRuns` по стенам обмера), не дальше; граница сноса и стена без выступа границу не расширяют (тесты T-26, T-26b, T-26c, T-26d, T-26d2, T-26e, T-26f, T-26g, T-26h, T-26i, T-26j, T-26k, T-26l, T-26m, T-26n).
- [x] 3.2 Проверить `unresolver` в `src/mounting/mounting-workspace.ts`: смещение отрицательного значения возвращается на исходную стену без изменений (тесты T-26b, T-26c).

## 4. Слияние стен (`wall-merge`)

Утверждённые тесты: `src/wall-merge-overhang.test.ts` (T-25, T-25b, T-25c).

- [x] 4.1 Убедиться, что `reattach` в `src/wall-merge.ts` корректно переносит отрицательное смещение; код менять только если T-25…T-25c красные (ожидается, что нет).

## 5. Итоговая проверка

- [x] 5.1 Запустить утверждённые тесты change: `npx vitest run src/doorway/opening-reach-body-end.test.ts src/doorway/opening-reach-body-end-storage.test.ts src/mounting/mounting-overhang.test.ts src/wall-merge-overhang.test.ts src/doorway/doorway-storage.test.ts src/doorway/door-storage.test.ts` — все зелёные.
- [x] 5.2 Запустить весь набор `npx vitest run` — 4024 теста зелёные, ни один тест не изменён по сравнению с утверждёнными (`git diff -- src/**/*.test.ts` показывает только `DS-03`/`DS-04` из `test-change-request.md` и новые файлы).
- [x] 5.3 Запустить проверку типов `npx tsc --noEmit` — без ошибок; запустить линт и форматирование, если они настроены в проекте (в `package.json` скрипта нет — сообщить об этом).
- [x] 5.4 Мутационное тестирование: инструмент в проекте не настроен; ограничиться ручными мутантами из `test-validation.md` (раздел 3) на финальной реализации — каждый должен быть убит.
- [x] 5.5 Проверить в браузере (Firefox, `http://localhost:5173/draw-repair/`, перезапустить dev-сервер): подставить чертёж пользователя (бэкап `drawing` и `history` в localStorage), окно `f9adac8e` на блочной стене `cf4f0b30` — перетащить вправо и ввести 0 в число расстояния: окно вплотную к бетонной стене (`offsetCm = −10`), подпись 0; окно `f4c93eec` у конца `b` остаётся у конца оси; комната из нескольких стен, нарисованных по одной; перезагрузка страницы; «Отменить»/«Повторить»; план «Монтаж».
- [x] 5.6 Записать в `TODO.md` остатки: T-26o (зеркало T-26m у конца `a`, выступ 5 см), сцена со скошенным стыком (грани заканчиваются в разных `t`) для «Монтажа», нижняя граница смещения в загрузчике.
- [x] 5.7 Проверить `openspec validate fix-opening-reach-body-end` и выполнить `/opsx:verify`; критические замечания исправить сразу; затем архивировать изменение, вручную синхронизировать спеки (`openspec/specs/doorway`, `drawing-storage`, `mounting-plan`) и закоммитить все файлы на текущей ветке.
