## Context

`drawSheet(doc, format, { name, scale, date })` (`src/export/sheet-draw.ts`) выводит графы 1, 6, 25, 13 из `titleBlockTexts` (`src/export/sheet-layout.ts`); графа 5 намеренно пуста. Страницы PDF — `PlanPage` из `pagesOf(drawing)` (по одной на план каталога `PLANS`, `src/plans.ts`).

## Decisions

### D1. Название страницы в содержимом основной надписи

`TitleBlockContent` получает необязательное `pageName?: string`; `titleBlockTexts` добавляет `{ cellId: "5", text: pageName }`, если оно задано и не пусто. `drawSheet` ничего не меняет: графа 5 рисуется общим кодом (кегль содержимого 3,5 мм, по центру графы, `fitText` сжимает длинный текст).

### D2. Название плана на странице

`PlanPage` получает необязательное `title?: string`; `pagesOf` задаёт `title: plan.label` из каталога; `drawPage` передаёт его как `pageName` (без поля — графа 5 пуста). Необязательность сохраняет вызовы `buildPdf`/`buildPdfPages` с готовыми страницами без плана.

## Risks / Trade-offs

- Название плана не входит в имя файла PDF (вне объёма).