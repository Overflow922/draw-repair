## 1. Название плана в графе 5

Спецификация: `pdf-export` «Заполнение основной надписи»; design D1–D2. Утверждённые тесты: `plan-names-pdf.test.ts` и существующие (после TCR-1).

- [x] 1.1 `src/export/sheet-layout.ts`: `TitleBlockContent.pageName`, `titleBlockTexts` выводит графу 5.
- [x] 1.2 `src/export/pdf.ts`: `PlanPage.title`, `pagesOf` задаёт название плана, `drawPage` передаёт его в основную надпись.

## 2. Проверка и завершение

- [x] 2.1 `npx vitest run`, `npx tsc --noEmit`, `npm run build`.
- [x] 2.2 `openspec validate`, синк спецификации, архивация, коммит в текущей ветке.