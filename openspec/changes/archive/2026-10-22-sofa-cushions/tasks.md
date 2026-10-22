## 1. Рисунок

- [x] 1.1 Тесты рисунка дивана: две линии подушек (числа из спеки), узкий диван, масштаб деталей
- [x] 1.2 `sofaDrawing`: две вертикальные линии на 1/3 и 2/3 ширины сиденья

## 2. Проверки

- [x] 2.1 Quality gates: `npx tsc --noEmit`, `npx vitest run --exclude ".claude/**" --exclude "node_modules/**"`, `openspec validate sofa-cushions --strict`, просмотр `git diff`
