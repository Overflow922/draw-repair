## 1. Размеры пометки по граням

Спецификация: `demolition-plan` «Выделение пометки и правка чисел на месте», «Размерные линии пометок»; design D1–D4. Утверждённые тесты: `mark-chains.test.ts`, `mark-numbers-faces.test.ts`, `demolition-tool-faces.test.ts`, `mark-dimensions.test.ts`, `demolition-sizes-render.test.ts` и существующие (после TCR-1…TCR-6).

- [x] 1.1 `src/demolition/mark-chains.ts`: `faceBounds`, `markChains`, `NumberTarget`.
- [x] 1.2 `src/demolition/mark-numbers.ts`: `NumberRef`, `MarkNumberSpot` со стороной, `editNumber` по граням; `numbersOf`, `markNumberLayout`, `markLabelSpot` удалены.
- [x] 1.3 `src/demolition/mark-dimensions.ts`: `markDimensions(r, walls, mode, …)`, `markDimensionExtent(r, walls, k, m)`.
- [x] 1.4 `src/demolition/demolition-render.ts`: выделенная — цепочка с подчёркиванием, превью — цепочка, невыделенные — ничего на экране, режим `widths` (PDF); подсветка ластика.

## 2. Клик по снесённой области и ластик

Спецификация: `demolition-plan` «Инструмент «Демонтаж»», «Ластик на плане «Демонтаж»»; `drawing-plans` «Инструменты плана»; `drawing-history`; design D5. Тесты: `demolition-eraser.test.ts`, `plan-tools.test.ts`.

- [x] 2.1 `src/demolition/demolition-tool.ts`: клик по снесённой области ничего не меняет; `erase`, `eraseTarget`; `numberAt`/`applyNumber` по граням.
- [x] 2.2 `src/plans.ts`: «Ластик» в наборе плана «Демонтаж».
- [x] 2.3 `src/main.ts`: клик и подсветка ластика на плане «Демонтаж», число правится по ссылке `{ target, side }`; `src/export/pdf.ts`: `widths: true` и стены страницы в габаритах.

## 3. Проверка и завершение

- [x] 3.1 `npx vitest run` (120 файлов, 2728 тестов), `npx tsc --noEmit`, `npm run build`.
- [x] 3.2 Ручные проверки MAN-01 … MAN-03 в браузере (комната: шесть размеров 900/900/3000 и 1100/900/3200; ластик с подсветкой удаляет пометку, «Отменить» возвращает; клик «Демонтажем» по снесённой области ничего не меняет). MAN-04 (PDF) покрыт тестами `demolition-pdf.test.ts`, `demolition-dimensions-pdf.test.ts`.
- [x] 3.3 `openspec validate`, итоговый `git diff`, синк спецификаций, архивация, коммит в текущей ветке.
