# IMS AI Platform

Уеб платформа за управление на интегрирани системи по ISO 9001, ISO 14001, ISO 45001, ISO/IEC 27001 и ISO 50001.

## Стартиране локално

```bash
npm install
npm run dev
```

Отворете `http://localhost:3000`.

## Свързване със Supabase

### 1. Създаване на таблиците

За нов Supabase проект изпълнете файла:

`supabase/migrations/001_initial_schema.sql`

Ако първата миграция вече е била изпълнена, изпълнете само:

`supabase/migrations/002_add_organization_standards.sql`

SQL файловете се изпълняват от Supabase Dashboard -> SQL Editor.

### 2. Създаване на единствения потребител

Отворете Supabase Dashboard -> Authentication -> Users и създайте потребител с вашия имейл и парола. В приложението умишлено няма публична регистрация.

### 3. Настройки на приложението

Създайте `.env.local` и добавете:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
AI_PROVIDER=mock
```

Стойностите са в Supabase Dashboard -> Project Settings -> API. Не поставяйте `service_role` ключ във frontend настройките.

### 4. Настройки във Vercel

Добавете същите две променливи във Vercel -> Project -> Settings -> Environment Variables и направете нов deployment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

След deployment приложението показва екран за вход. След успешен вход фирмите се четат и записват директно в таблицата `organizations`.

## Проверка

1. Влезте в приложението.
2. Добавете фирма `Тест Фирма ООД`.
3. Отворете Supabase Dashboard -> Table Editor -> `organizations`.
4. Проверете дали редът присъства.
5. Редактирайте фирмата в приложението и обновете таблицата в Supabase.

Зеленият надпис `Supabase` в таблото означава, че конфигурацията е открита. Надпис `Локален режим` означава, че липсват URL или anon key.

## AI слой

Приложението има endpoint `POST /api/ai/draft`. При `AI_PROVIDER=mock` той връща демонстрационен структуриран отговор.
