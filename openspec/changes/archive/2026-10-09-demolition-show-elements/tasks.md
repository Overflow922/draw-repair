## 1. Отрисовка элементов на плане «Демонтаж»

Спецификация: `demolition-plan` «Элементы стены в зоне сноса», «Отображение плана «Демонтаж»»; design D1. Утверждённые тесты: `src/demolition/demolition-render.test.ts` (RN-05, RN-14 … RN-19).

- [x] 1.1 В `src/render.ts` добавить `drawElementsLayer(ctx, walls, unit, view, opts)` — слой элементов отдельно от стен.
- [x] 1.2 В `src/demolition/demolition-render.ts` рисовать слой элементов после областей сноса серым цветом подложки.

## 2. Удаление скрытия и страница PDF

Спецификация: `pdf-export` «Страница плана «Демонтаж»»; design D2. Утверждённые тесты: `src/export/demolition-pdf.test.ts` (PG-04, PG-21 … PG-23), `src/demolition/mark-region.test.ts` (TCR-1).

- [x] 2.1 В `src/demolition/mark-region.ts` удалить `hiddenElements` и `visibleElements`.
- [x] 2.2 В `src/export/pdf.ts` передавать на страницу демонтажа все элементы; `pageBounds` всегда учитывает элементы.
- [x] 2.3 В `src/main.ts` передавать на холст плана «Демонтаж» все элементы.

## 3. Проверка и завершение

- [x] 3.1 `npx vitest run` — весь набор зелёный; в `git diff` изменены только тесты из TCR-1 … TCR-4 и ни один тест не изменён после валидации.
- [x] 3.2 `npx tsc --noEmit` и `npm run build`; линтер и форматтер в проекте не настроены.
- [x] 3.3 Проверить вручную MAN-01 … MAN-03 в браузере.
- [x] 3.4 `openspec validate`, итоговый `git diff`, `TODO.md`, архивация (синк спецификаций через `ReadAllText`/`WriteAllText` без функций с именами алиасов), коммит в текущей ветке.
