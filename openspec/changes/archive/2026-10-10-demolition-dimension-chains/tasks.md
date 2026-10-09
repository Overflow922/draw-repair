## 1. Размерные линии пометок на экране

Спецификация: `demolition-plan` «Размерные линии пометок»; design D1–D3. Утверждённые тесты: `mark-dimensions.test.ts`, `demolition-dimensions-render.test.ts` (DC-01 … DC-16) и существующие (после TCR-1…TCR-3).

- [x] 1.1 `src/render.ts`: экспорт `drawDimensionGeom`.
- [x] 1.2 `src/demolition/mark-dimensions.ts`: `markDimensions`, `markDimensionExtent`.
- [x] 1.3 `src/demolition/demolition-render.ts`: числа пометок и превью рисуются размерами; нулевой размер — только число.

## 2. Страница PDF

Спецификация: `pdf-export` «Размеры пометок на странице демонтажа»; design D4. Тесты: `demolition-dimensions-pdf.test.ts` (DC-20 … DC-26).

- [x] 2.1 `src/export/pdf.ts`: `wallsBBox` принимает дополнительные точки, `pageBounds` экспортируется и учитывает размеры пометок страницы демонтажа.

## 3. Проверка и завершение

- [x] 3.1 `npx vitest run` (115 файлов, 2610 тестов), `npx tsc --noEmit`, `npm run build`.
- [x] 3.2 Ручная проверка MAN-01 (экран: размеры, цепочка выделенной пометки). MAN-02/MAN-03 покрыты тестами превью и PDF (DC-13, DC-20, DC-25).
- [x] 3.3 `openspec validate`, итоговый `git diff`, синк спецификаций, архивация, коммит в текущей ветке.
