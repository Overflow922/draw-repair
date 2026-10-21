## 1. Каталог

- [x] 1.1 Добавить запись «Стул» в `FURNITURE_KINDS` (`src/furniture/furniture-kinds.ts`): название, слово плашки, размеры 45 × 45 × 0°, цвета светлой и тёмной схемы, иконка; проверить, что `furniture-kinds.test.ts` (в т.ч. FIK-12 различимость цвета) проходит
- [x] 1.2 Обновить утверждения о составе каталога: FIK-01 (`furniture-kinds.test.ts`) и FP-361 (`furniture-ui.test.ts`), пометка `// TCR (change add-furniture-chair): в каталоге новый вид`; проверить, что оба теста проходят

## 2. Проверки

- [x] 2.1 Проверить тест FP-414 (`furniture-pdf.test.ts`): легенда со всеми видами помещается на A3
- [x] 2.2 Проверка в браузере (`/draw-repair/`): кнопка «Стул», размеры по умолчанию, призрак и цвет на светлой и тёмной схеме, плашки «Стул пересекается: стена» и «Мебель пересекается: стол, стул», запись легенды в PDF
- [x] 2.3 Quality gates: `npx tsc --noEmit`, полный `npx vitest run --exclude ".claude/**" --exclude "node_modules/**"`, `openspec validate add-furniture-chair --strict`, просмотр `git diff`
