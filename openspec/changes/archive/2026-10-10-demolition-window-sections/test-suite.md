# Test Suite

Прогон до реализации: `mark-sections.test.ts` не собирается (нет модуля `mark-sections`), в `demolition-sections.test.ts` и `demolition-sections-pdf.test.ts` падает часть тестов (инструмент и `effectiveMarks` блокируют стену целиком, а не участок окна).

## Tests

| ID | Test File | Покрывает | Initial Result |
|---|---|---|---|
| SW-01 … SW-08 | src/demolition/mark-sections.test.ts | `windowBlocks`, `cleanRanges`: свободная стена, перегородка (грань +1 и −1), комната, окно справа, окна по обе стороны, два окна, привязка b, проём и дверь, окно другой стены, железобетон, вырожденная, входы | FAIL (нет модуля) |
| SW-10 … SW-14 | src/demolition/mark-sections.test.ts | `effectiveMarks` с участками: чистый участок, пересечение, допуск 0,01 см, окно удалено, привязка b, железобетон, проём и дверь | FAIL |
| SW-20 … SW-25 | src/demolition/demolition-sections.test.ts | инструмент: клик по чистому участку, в разрыве, по участку окна, слияние, свободная стена, без окна, окно на другой стене; протяжка с обрезкой, превью, начало на участке окна, за конец стены | FAIL (часть) |
| SW-30 … SW-32 | src/demolition/demolition-sections.test.ts | скрытая пометка: не выбирается, не стирается, не подсвечивается; возврат после удаления окна | FAIL/PASS |
| SW-40 … SW-42 | src/export/demolition-sections-pdf.test.ts | `pagesOf`: чистая пометка на странице, пометка через участок окна — нет, окно перенесено | FAIL (часть) |

## Test Change Requests (применены)

TCR-1 (`test-plan.md`): `mark-windows.test.ts` — `canDemolish` без элементов; варианты с элементами перенесены в `mark-sections.test.ts`.

## Unexpected Passes

Защитные проверки (без окон чистый участок — вся стена, железобетон, окно другой стены) проходят до реализации.

## Tests That Could Not Run

Ручной MAN-01.