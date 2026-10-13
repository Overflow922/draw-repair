## 1. Чистый модуль длины (`src/wall-length.ts`)

Спека: `length-input` «Длина стены от кромки до кромки»; design D1, D2, D3, D5. Одобренные тесты: `src/wall-length.test.ts` (OH-*, SO-*, PV-*, RS-0, RS-0a, RS-1), `src/wall-length.test-utils.ts`. Тесты не менять.

- [x] 1.1 В `src/wall-geometry.ts` вынести предикат коллинеарной ветки `pairEnd` (один сосед в допуске `jointTol`, вершина в полосе соседа, коллинеарность в допуске `RIGHT_COS`, стена поздняя в массиве) в экспортируемую функцию, которой пользуются и тело (`pairEnd`), и новый модуль; форма тела не меняется (существующие тесты `wall-geometry*.test.ts` проходят без правок).
- [x] 1.2 Создать `src/wall-length.ts`: `endOverhangCm(wall, end, walls)` — расстояние от вершины до конца оси ранней стены в коллинеарной ветке, иначе 0 (углы, T, свободный конец, три и более концов, почти коллинеарный стык, ранняя стена). Тесты OH-1 – OH-13, OH-15 – OH-18.
- [x] 1.3 В `src/wall-length.ts`: `edgeLengthCm(wall, walls)` = ось + выступы обоих концов. Тесты OH-3, OH-8, OH-9, OH-14.
- [x] 1.4 В `src/wall-length.ts`: `startOverhangCm(ref, start, dir)` — проекция `start − anchor` на `dir` для опоры `cap` с `anchor`, сегмент коллинеарен нормали в допуске 0.5° и идёт от тела; иначе 0. Тесты SO-1 – SO-6.
- [x] 1.5 В `src/wall-length.ts`: `previewEdgeLengthCm(ref, start, end)` = длина сегмента + `startOverhangCm` (0 для нулевого сегмента). Тесты PV-1 – PV-7.
- [x] 1.6 В `src/wall-length.ts`: `axisLengthForEdgeCm(wall, walls, edgeCm)` = `edgeCm` − выступы, `null` при результате не больше 0. Тесты RS-0, RS-0a, RS-1 (совместно с `resizeWallBounded`).

## 2. Ввод длины при рисовании

Спека: `length-input` «Фиксация вершины по введённой длине»; design D2, D4. Одобренные тесты: `src/wall-length-chain.test.ts` (TL-*, MG-1, BE-1, BE-2).

- [x] 2.1 В `src/wall-chain.ts` (`chainSegment`): при введённой длине вычитать `startOverhangCm(ref, start, dir)`; если введённое значение не больше выступа, считать ввод неприменённым (сегмент как без ввода). Сигнатура `ChainInput`/`ChainSegment` не меняется. Тесты TL-1 – TL-6, BE-1, BE-2.
- [x] 2.2 Проверить, что `mergeContinuation` (`src/wall-merge.ts`) без правок удлиняет стену ровно на введённую длину. Тест MG-1. Код слияния не менять, если тест проходит.

## 3. Линейка

Спека: `ruler-tool` «Замер стены по оси»; design D6. Одобренные тесты: `src/wall-length-chain.test.ts` (RL-*, BE-2).

- [x] 3.1 В `src/ruler.ts` (`rulerReading`, ветка стены): сдвинуть `from`/`to` с вершин оси на плоскости торцов на выступы концов, `lengthCm = edgeLengthCm`. Тесты RL-1, RL-1a (кромка), RL-2 – RL-4 (регрессия).

## 4. Проводка в интерфейсе (`src/main.ts`)

Спека: `length-input` «Живое значение длины», сценарии «Живая длина превью», «Выделенная стена с выступом торца», «Ввод длины выделенной стены с выступом торца»; design D3, D5. Тонкая проводка автотестами не покрыта (test-plan, Out of Scope).

- [x] 4.1 `previewLengthCm` вызывает `previewEdgeLengthCm(chainRef, chainStart, end)`.
- [x] 4.2 `liveLengthCm` для выделенной стены возвращает `edgeLengthCm(sel, walls)`.
- [x] 4.3 `resizeSelected` передаёт в `resizeWallBounded` результат `axisLengthForEdgeCm(sel, walls, typed)`; при `null` ввод отклоняется.
- [x] 4.4 Проверить вручную в браузере (сервер на `/draw-repair/`, перезапустить перед проверкой): коллинеарное продолжение от торца, ввод 1512 мм при толщине 195 мм — тело 1512, линейка 1512 от кромки; поле выделенной стены и ввод в него; слияние того же материала; угол и T без изменений. Закрыть пункт «Tests» в `TODO.md` (`fix-collinear-edge-to-edge-length`), если проверка прошла.

## 5. Итоговая проверка

- [x] 5.1 Формат/линт, если настроены в проекте.
- [x] 5.2 `npx tsc --noEmit` — без ошибок.
- [x] 5.3 Одобренные тесты: `npx vitest run src/wall-length.test.ts src/wall-length-chain.test.ts` — все 56 проходят; файлы тестов не изменены (`git diff` по ним пуст относительно принятых).
- [x] 5.4 Полный набор тестов: `npx vitest run`; падений нет (в том числе у существующих тестов геометрии стыков, ввода длины и линейки).
- [x] 5.5 Интеграционные/e2e: `src/ruler-e2e.test.ts`, `src/wall-merge.test.ts` в составе полного набора.
- [x] 5.6 Мутационное тестирование не настроено в проекте — пропустить; мутанты уже проверены валидатором (`test-validation.md`).
- [x] 5.7 `openspec validate fix-collinear-edge-to-edge-length --strict` и `/opsx:verify` по OpenSpec; критичные замечания исправить в этой же сессии.
- [x] 5.8 Просмотр итогового `git diff`: нет отладочного кода, нет случайных правок; перед коммитом удалить временные конфиги и заглушки, если остались.
- [x] 5.9 Заархивировать change (`/opsx:archive`), синхронизировать спеки вручную при необходимости (см. заметки об архивации), закоммитить все файлы изменения на текущей ветке.
