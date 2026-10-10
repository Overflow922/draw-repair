# Test Suite

Прогон до реализации: 6 из 9 тестов `plan-names-pdf.test.ts` падают (нет `pageName` и `title`), защитные проверки (PN-03, PN-04 в части графы 1, PN-11) проходят.

## Tests

| ID | Test File | Покрывает | Initial Result |
|---|---|---|---|
| PN-01 … PN-06 | src/export/plan-names-pdf.test.ts | сборка PDF из `pagesOf`: название плана в графе 5 на каждой странице, по центру, один текст, чужого названия нет, графа 1 и остальные графы прежние, имя чертежа «Демонтаж» не мешает | FAIL (PN-01, 02, 05, 06) |
| PN-10 … PN-12 | src/export/plan-names-pdf.test.ts | `titleBlockTexts` с `pageName`, без него и с пустым, независимость от имени | FAIL (PN-10, PN-12), PASS (PN-11) |

## Test Change Requests

Нет.

## Unexpected Passes

PN-03, PN-11 — защитные.

## Tests That Could Not Run

Ручной MAN-01.