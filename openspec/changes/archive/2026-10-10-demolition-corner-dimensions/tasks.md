Тесты утверждены (`test-validation.md`: VERDICT: PASS). Задачи меняют только продакшн-код; файлы тестов (`src/**/*.test.ts`, `corner-dimensions.test.ts`) не правятся. Контракт API — `design.md`, решение 5.

## 1. Размеры пометки без нулевых и без режима «width»

- [x] 1.1 `src/demolition/mark-dimensions.ts`: `markDimensions` возвращает только размеры ненулевой длины, у каждого непустая `geom` (тип `MarkDimension.geom` перестаёт быть nullable, ветка «только число» удаляется); порог нуля сохраняется (`ZERO`). Требования: `demolition-plan` «Размерные линии пометок», «Выделение пометки и правка чисел на месте». Тесты: `corner-dimensions.test.ts` (CD-05, CD-07, CD-12, CD-24), `mark-dimensions.test.ts` (DC-03, DC-08, NU-11).
- [x] 1.2 `src/demolition/mark-dimensions.ts`: убрать параметр режима `"width"`; сигнатура `markDimensions(span, walls, "chain", unit, k, labelPx)` остаётся, тип режима сводится к `"chain"` (или параметр удаляется вместе с вызовами). Тесты: `mark-dimensions.test.ts`, `corner-dimensions.test.ts`.
- [x] 1.3 `src/demolition/mark-dimensions.ts`: `markDimensionExtent` возвращает точки всей цепочки обеих граней — концы выносных линий за размерной линией и четыре угла каждого числа; пустой список при отсутствии размеров. Требование: `pdf-export` «Размеры пометок на странице демонтажа». Тесты: `mark-dimensions.test.ts` (CD-15, CD-22), `demolition-dimensions-pdf.test.ts` (CD-15, CD-17, DC-24, DC-25, PG-18).

## 2. Отрисовка

- [x] 2.1 `src/demolition/demolition-render.ts`: цепочка рисуется у каждой действующей пометки и у превью; `selectedId` управляет только подчёркиванием; поле `widths` удаляется из `DemolitionOptions`; ветка `drawNumber` для нулевых чисел удаляется, если стала недостижимой. Требования: `demolition-plan` «Размерные линии пометок», «Отображение плана «Демонтаж»». Тесты: `demolition-sizes-render.test.ts` (CD-03, CD-05…CD-10, CD-21, CD-23, SZ-50…SZ-61), `demolition-dimensions-render.test.ts` (DC-10, DC-14), `demolition-render.test.ts` (RN-03, RN-06).
- [x] 2.2 `src/export/pdf.ts`: вызов `drawDemolitionScene` без `widths`; габариты страницы демонтажа (`markDimensionExtent`) учитывают цепочку; убедиться, что список форматов и размещение на листе используют те же габариты. Требование: `pdf-export` «Размеры пометок на странице демонтажа». Тесты: `demolition-dimensions-pdf.test.ts` (CD-11, CD-14, CD-15, CD-17, DC-24, DC-25), `demolition-pdf.test.ts` (PG-04, PG-18).

## 3. Потребители и чистка

- [x] 3.1 `src/demolition/demolition-tool.ts` (и другие вызовы `markDimensions`): привести к новой сигнатуре; попадание клика по числам работает без нулевых целей. Тесты: `corner-dimensions.test.ts` (CD-24), `demolition-tool*.test.ts`.
- [x] 3.2 Убрать мёртвый код после изменений (неиспользуемые экспорты и типы, комментарии про режим «width»/`widths`); без новых абстракций.

## 4. Документация и спецификации

- [x] 4.1 `TODO.md`: после архивации обновить формулировку «ширину участка числом рядом с ним» в требовании PDF «Страница демонтажа» (`pdf-export`) и отметить пункт сделанным.

## 5. Проверка

- [x] 5.1 Форматирование и линт в проекте не сконфигурированы (нет скриптов в `package.json`); `npx tsc --noEmit` без ошибок.
- [x] 5.2 Утверждённые тесты: `npx vitest run src/demolition/corner-dimensions.test.ts src/demolition/mark-dimensions.test.ts src/demolition/demolition-sizes-render.test.ts src/demolition/demolition-dimensions-render.test.ts src/demolition/demolition-render.test.ts src/export/demolition-dimensions-pdf.test.ts src/export/demolition-pdf.test.ts` — все зелёные, файлы тестов не изменены (`git diff` по ним пуст).
- [x] 5.3 Полный набор `npx vitest run` и интеграционные проверки PDF; мутационное тестирование не сконфигурировано в проекте (в `package.json` нет Stryker) — не выполняется.
- [x] 5.4 Ручная проверка в браузере (draw-repair на `/draw-repair/`, перезапустить dev-сервер): план «Демонтаж», стена 500 см и комната стена за стеной — цепочка видна у невыделенных пометок на обеих гранях, нулевой отступ без «0», две пометки на одной стене; экспорт PDF — цепочка на странице демонтажа.
- [x] 5.5 `/opsx:verify` (OpenSpec verification), финальный просмотр `git diff` на лишние изменения; затем архивация и коммит на текущей ветке.
