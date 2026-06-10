# 📋 NaZdrow! — Приоритеты и План Улучшений

**Дата анализа:** 24 май 2026  
**Статус проекта:** Active Development  
**Язык документации:** Русский 🇷🇺 / Польский 🇵🇱

---

## 📊 ОБЗОР ПРОЕКТА

### Что такое NaZdrow!?

**NaZdrow!** — это маркетплейс для поиска личных тренеров в Польше. Приложение создано на **Next.js** с использованием **Supabase** для базы данных.

### Архитектура

```
┌─────────────────────────────────────┐
│  Клиентская часть                   │
│  (поиск тренеров, бронирование)     │
├─────────────────────────────────────┤
│  Студия тренеров (trainer backend)  │
│  (управление профилем, клиентами)  │
├─────────────────────────────────────┤
│  Admin панель                       │
│  (проверка сертификатов)            │
├─────────────────────────────────────┤
│  Суpabase (БД + Auth)               │
└─────────────────────────────────────┘
```

### Текущий статус

| Компонент | Статус | Примечание |
|-----------|--------|-----------|
| Landing page v1 | ✅ Live | Старая версия |
| Landing page v2 | 📋 Spec ready | Требует разработки |
| Studio Dashboard | ✅ 60% ready | 3 режима (Empty/Working/Growth) |
| Studio Календарь | ✅ Done | Расписание, dostępność |
| Studio Профиль | ⚠️ 80% ready | Требует OLX-style переделки |
| Studio Klienci | 🔴 Mock only | Использует MOCK_CLIENTS |
| Auth + Account | ✅ Done | Есть signin/signup |

---

## 🎯 ОСНОВНЫЕ БЛОКЕРЫ И ТРЕБОВАНИЯ

### Требуемые ✅ функции для включения "Zostań trenerem" CTA на landing

Перед тем, как начать привлекать тренеров через рекламный "Zostań trenerem" (Стань тренером) кнопку, нужно завершить:

#### 9.1 Studio · Dostępność — ✅ **ЗАВЕРШЕНО**
- [x] Рекурсивное недельное расписание (multi-shift)
- [x] Per-date исключения (переопределения)
- [x] Holiday-presets (Urlop/Weekend/Konferencja)
- [x] Booking-flow уважает переопределения
- [ ] Migration 030 применена в prod

#### 9.2 Studio · Klienci — 🔴 **НЕ НАЧИНАЛИ**
- [ ] Список клиентов + фильтры (active/paused/lost)
- [ ] Side panel на клиента: история бронирований, заметки, цели, статус пакета
- [ ] Встроенный чат per client (переиспользовать `/studio/messages` компоненты)
- [ ] Заметки на уровне сессии (после каждой завершённой сессии)

#### 9.3 Studio · Profil OLX-style — 🔴 **НЕ НАЧИНАЛИ**
- [ ] Единый редактор профиля (basics + design объединены, no two-page flow)
- [ ] Inline-редактирование: фото, имя, tagline, местоположение, цены услуг
- [ ] Галерея фото (min 3 фото для публикации)
- [ ] Public preview совпадает с listing-card данными (price lines, badges, etc.)

#### 9.4 Klient-side — ✅ **ЧАСТИЧНО ГОТОВО**
- [x] Pulpit, Treningi, Trener (chat), Profil (4-section sidebar)
- [ ] Mobile responsive (можно после desktop landing v2)

---

## 🚨 ВЫЯВЛЕННЫЕ ПРОБЛЕМЫ

### Критические 🔴

#### 1. **Неработающие кнопки на `/studio/klienci`**
```
❌ "Uzupełnij portfel" (Fill wallet)
   └─ Причина: нет onClick обработчика
   └─ Статус: неработающая кнопка

❌ "Dodaj klienta" (Add client)
   └─ Причина: нет onClick обработчика
   └─ Статус: неработающая кнопка
```

**Файл:** `src/app/studio/klienci/page.tsx` (строки 83-98)

**Решение:**
1. Обработчик для "Uzupełnij portfel" → перенаправление на /studio/finanse
2. Обработчик для "Dodaj klienta" → открыть modal или перейти на /studio/klienci/new

#### 2. **Якорь `#packages` может не работать**
```
Кнопка: "Nowy pakiet"
href: "/studio/design#packages"
```

**Проблема:** Якорь к секции на одной странице требует проверки.

**Решение:** Убедиться, что на странице `/studio/design` есть элемент с id="packages"

#### 3. **Mock data вместо реальной БД**
```
File: src/data/mock-clients.ts
Problem: ClientCard использует MOCK_CLIENTS вместо реальных данных из Supabase
```

**Когда фиксить:** После создания миграции `031_clients` в Supabase

### Требует проверки 🟡

1. Clickability message rows на `/studio/messages`
2. Clickability client cards на `/studio/klienci`
3. Clickability review cards на `/studio/reviews`
4. Navigation между sub-pages в Studio

---

## 📊 СТАТУС СТРАНИЦ STUDIO

| Маршрут | Компонент | Статус | Примечания |
|---------|-----------|--------|-----------|
| `/studio` | Pulpit (Dashboard) | ✅ 95% | 3 режима работают |
| `/studio/calendar` | Календарь + Бронирования | ✅ 90% | Query params работают |
| `/studio/calendar?mode=pattern` | Dostępność (Расписание) | ✅ 95% | Основной функционал готов |
| `/studio/klienci` | Список клиентов | ⚠️ 60% | MOCK data, неработающие кнопки |
| `/studio/klienci/[id]` | Профиль клиента | ❓ Unknown | Требует проверки |
| `/studio/messages` | Чат с клиентами | ✅ 85% | Требует проверки clickability |
| `/studio/profile` | Публичный профиль | ✅ 70% | Требует OLX-style переделки |
| `/studio/design` | Редактор дизайна | ✅ 75% | Нужна проверка якоря #packages |
| `/studio/services` / `/studio/uslugi` | Услуги | ✅ 80% | Hidden from nav |
| `/studio/packages` | Пакеты | ✅ 75% | Hidden from nav |
| `/studio/reviews` | Отзывы | ✅ 80% | Требует проверки |
| `/studio/kupony` | Купоны | ✅ 70% | Sub-item в Profil |
| `/studio/finanse` | Финансы | ✅ 80% | Mark paid workflow |
| `/studio/bookings` | Skrzynka działań (Inbox) | ✅ 85% | Главная точка для экшнов |
| `/studio/availability` | Dostępność (old) | ⚠️ Deprecated | Перемещено в calendar?mode=pattern |
| `/studio/pages` | Custom pages | ✅ 70% | Управление лендингом профиля |
| `/studio/start` | Onboarding | ✅ 80% | День 1, заполнение профиля |

---

## 🎯 ПРИОРИТЕТЫ НА СЛЕДУЮЩИЕ 2 НЕДЕЛИ

### Priority 1️⃣: КРИТИЧЕСКИЕ БАГИ (Высокий приоритет)

```
⏳ Время: 2-4 часа

✓ Исправить две неработающие кнопки на /studio/klienci
  ├─ "Uzupełnij portfel" → handler или redirect
  ├─ "Dodaj klienta" → handler или modal
  └─ Тест обеих кнопок

✓ Проверить якорь #packages на /studio/design
  ├─ Убедиться, что элемент существует
  ├─ Убедиться, что якорь скроллит к нему
  └─ Тест из quick-action кнопки

✓ Проверить все internal href links
  ├─ Все ли /studio/* ссылки валидные?
  ├─ Есть ли 404ы?
  └─ Протестировать все quick-action кнопки
```

### Priority 2️⃣: УЛУЧШЕНИЯ НАВИГАЦИИ И UX (Средний)

```
⏳ Время: 6-8 часов

✓ Укрепить навигацию между Studio страницами
  ├─ Проверить все breadcrumbs
  ├─ Проверить back buttons
  └─ Убедиться, что active state верный

✓ Улучшить мобильную навигацию (Studio)
  ├─ Проверить StudioMobileTabs
  ├─ Убедиться, что все маршруты accessible на мобильных
  └─ Тест на разных экранах

✓ Добавить визуальные индикаторы для неполных задач
  ├─ Например: "⏳ Достаточность" badge на calendar
  ├─ "📋 Кlienci" badge для нужно добавить клиентов
```

### Priority 3️⃣: ФУНКЦИОНАЛЬНОСТЬ KLIENCI (Высокий)

```
⏳ Время: 20-24 часа

✓ Migrace с MOCK_CLIENTS на реальную БД
  ├─ Создать миграцию 031_clients (если не создана)
  ├─ Создать schema для clients table
  ├─ Реализовать getClientsForTrainer() в lib/db
  └─ Заменить MOCK_CLIENTS на реальный fetch

✓ Реализовать AddClientButton функционал
  ├─ Modal или форма для добавления клиента
  ├─ Validation на форме
  ├─ Create в Supabase
  └─ Optimistic update UI

✓ Реализовать Client Card clickability
  ├─ Перейти на /studio/klienci/[id]
  ├─ Показать детали клиента
  ├─ Показать историю сессий
  ├─ Встроенный чат
  └─ Заметки и goals
```

### Priority 4️⃣: PROFIL OLX-STYLE (Высокий)

```
⏳ Время: 32-40 часов

✓ Переделать /studio/profile на OLX-style
  ├─ Merge basics + design в один редактор
  ├─ Inline-edit для фото, имени, tagline, location
  ├─ Photo gallery (min 3 фото)
  ├─ Price editor для услуг
  ├─ Badge logic wiring (Verified/Promo/Online)
  └─ Public preview на rightside

✓ Реализовать photo gallery upload
  ├─ Min 3 фото constraint
  ├─ Drag-and-drop reorder
  ├─ Preview на card'е
  └─ Upload to Supabase storage

✓ Реализовать service price inline-edit
  ├─ Click to edit price
  ├─ Validation (min/max price)
  ├─ Save на blur
  └─ Update badge logic
```

### Priority 5️⃣: LANDING PAGE V2 (Средний)

```
⏳ Время: 40-50 часов (после priorities 1-4 завершены)

✓ Реализовать Hero с поиском
  ├─ Spec: specialization dropdown
  ├─ City autocomplete
  ├─ Budget slider (50-300 PLN)
  ├─ SZUKAJ button → /trainers?spec=X&city=Y&budget=Z
  └─ Sticky bar на scroll

✓ Реализовать Quick-chips (6 chipов)
  ├─ Top tygodnia (highest-rated + 3+ sessions)
  ├─ Promocje (any discount)
  ├─ <100 zł/sesja
  ├─ Nowi trenerzy (last 30 days)
  ├─ Online
  └─ Poranny grafik

✓ Реализовать Trener tygodnia (gold accent)

✓ Реализовать Polecani trenerzy grid (8 карточек)

✓ Реализовать Specjalizacje scroll row

✓ Реализовать Jak to działa section (3 steps)

✓ Реализовать Trust stats bar

✓ Реализовать Dla trenerów recruiting CTA
```

---

## 🔄 BACKLOG (Заморожено, но важно отслеживать)

| Фича | Причина отложения | ETA |
|------|-------------------|-----|
| Google Calendar sync | Требует OAuth + 2-way sync | v3 |
| Masowa wiadomość (bulk chat) | Compliance вопросы (consent) | v3 |
| A/B test trainer templates | 3 из 7 хватает для v1 | v2 |
| Tagi/segmenty klientów | Нужны ≥20 trainers using | v3 |
| Faktury (auto-VAT) | Нужна accounting integration | v3 |
| Custom holiday presets | 3 hardcoded covers 90% cases | v3 |
| Mobile landing | После desktop v2 | v2.1 |

---

## 📈 МЕТРИКИ И УСПЕХ

### Для завершения v1:

```
✅ Все 3 приоритета Studio (Dostępność, Klienci, Profil) завершены
✅ Zero broken buttons in Studio
✅ All href links работают
✅ Landing v2 live
✅ "Zostań trenerem" CTA включена
```

### KPIs для мониторить:

1. **Studio adoption rate** — % trainers с профилем filled
2. **Klienci engagement** — % trainers с добавленными clients
3. **Landing page conversion** — % clicks на trainer cards
4. **Mobile responsiveness** — % traffic from mobile

---

## 🛠️ ИНСТРУМЕНТЫ И ТЕХНОЛОГИИ

### Stack:
- **Frontend:** Next.js 16+, React 19, Tailwind CSS, TypeScript
- **Backend:** Supabase (PostgreSQL + Auth)
- **UI:** FullCalendar, QRCode
- **Deployment:** Vercel (assumed)

### Важные файлы для работы:

```
src/
├─ app/
│  ├─ studio/
│  │  ├─ page.tsx              ← Dashboard главная
│  │  ├─ nav-items.tsx         ← Nav config
│  │  ├─ klienci/page.tsx      ← Clients list (MOCK)
│  │  ├─ design/page.tsx       ← Profile editor
│  │  ├─ calendar/page.tsx     ← Calendar + Dostępność
│  │  └─ layout.tsx            ← Studio wrapper
│  └─ page.tsx                 ← Landing page v1
├─ lib/
│  ├─ db/
│  │  ├─ trainers.ts           ← getTrainers()
│  │  └─ favorites.ts
│  └─ supabase/
│     └─ server.ts
├─ data/
│  ├─ mock-clients.ts          ← ⚠️ MOCK DATA
│  └─ specializations.ts
└─ components/
   └─ (UI components)
```

### Landing v2 spec:
- `landing-v2-spec.md` ← Source of truth для homepage rebuild

---

## 📅 TIMELINE

```
Week 1 (24-30 май):
├─ Понедельник: Исправить критические баги (Priority 1) ✓
├─ Вторник: Улучшить навигацию (Priority 2)
├─ Среда: Начать работу на Klienci (Priority 3)
└─ До Пятницы: Завершить основное в Klienci

Week 2 (31 май - 6 июня):
├─ Понедельник: Завершить Klienci
├─ Вторник-Четверг: Profil OLX-style (Priority 4)
├─ Пятница: Тестирование и fixes
└─ К концу: Готовность к Landing v2

Week 3+ (7 июня+):
└─ Landing Page v2 (Priority 5)
```

---

## ✍️ ВЫВОДЫ

**NaZdrow!** — это амбициозный проект маркетплейса тренеров с хорошо спроектированной архитектурой. Основные направления работы:

1. **Сейчас:** Исправить баги и укрепить существующий функционал
2. **Затем:** Реализовать критические features для тренеров (Klienci + Profile)
3. **После:** Landing v2 для привлечения клиентов

Все требования задокументированы, есть спеки, есть mock data. Готово к разработке!

---

*Документ создан 24 май 2026 для Ивана*
*NaZdrow! — Здоровье как жизненный стиль 💪*
