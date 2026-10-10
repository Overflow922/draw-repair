## 1. Стены с окном не сносятся

Спецификация: demolition-plan «Что сносится и что нет», «Элементы стены в зоне сноса»; design D1–D3. Утверждённые тесты: mark-windows.test.ts, demolition-windows.test.ts, demolition-windows-pdf.test.ts.

- [x] 1.1 src/demolition/mark-model.ts: canDemolish(wall, elements) и effectiveMarks(marks, walls, elements) учитывают окна.
- [x] 1.2 src/demolition/demolition-tool.ts: нажатие на стену, которую нельзя сносить, жеста не начинает; поиск пометок учитывает окна.
- [x] 1.3 src/main.ts, src/export/pdf.ts: элементы чертежа передаются в effectiveMarks.

## 2. Проверка и завершение

- [x] 2.1 `npx vitest run` (123 файла, 2762 теста), `npx tsc --noEmit`, `npm run build`.
- [x] 2.2 Ручная проверка MAN-01 в браузере: стена с окном — пометка не показана, клик инструментом ничего не создаёт.
- [x] 2.3 `openspec validate`, синк спецификации, архивация, коммит в текущей ветке.