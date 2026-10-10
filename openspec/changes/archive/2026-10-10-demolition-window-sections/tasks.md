## 1. Окно блокирует участок стены

Спецификация: `demolition-plan` «Что сносится и что нет», «Инструмент «Демонтаж»»; design D1–D3. Утверждённые тесты: `mark-sections.test.ts`, `demolition-sections.test.ts`, `demolition-sections-pdf.test.ts`.

- [x] 1.1 `src/demolition/mark-sections.ts`: `canDemolish`, `windowBlocks`, `cleanRanges`.
- [x] 1.2 `src/demolition/mark-model.ts`: `effectiveMarks` скрывает пометки через участок окна (`canDemolish` — только стена).
- [x] 1.3 `src/demolition/demolition-tool.ts`: чистый участок под нажатием, обрезка протяжки и клика, слияние только с действующими пометками.

## 2. Проверка и завершение

- [x] 2.1 `npx vitest run` (126 файлов, 2810 тестов), `npx tsc --noEmit`.
- [x] 2.2 Ручная проверка MAN-01 в браузере: комната с перегородкой, окно слева — клик по части с окном ничего не делает, по правой части помечает её.
- [x] 2.3 `openspec validate`, синк спецификации, архивация, коммит в текущей ветке.