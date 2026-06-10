# 🔍 Аудит кнопок и навигации — NaZdrow! Studio

**Дата аудита:** 24 май 2026  
**Цель:** Убедиться, что все кнопки работают и ведут куда надо  
**Статус:** In Progress ✅

---

## 1. ГЛАВНАЯ СТРАНИЦА STUDIO (`/studio`)

### ✅ Структура (зафиксирована в `studio/page.tsx`)

Главная страница имеет 3 режима:
- **Empty** — онбординг для новых тренеров
- **Working** — рабочая версия (основная)
- **Growth** — режим роста

### 📊 Working режим (основной) — Компоненты и кнопки

#### **1. KPI ROW** (4 карточки)
- Сессии · этот тиждень
- Доход · текущий месяц
- Средняя ocena (rating)
- Активные клиенты

**Статус:** ✅ Только display, нет кликов

---

#### **2. LEFT COLUMN**

**2.1 Revenue Chart (12 месяцев)**
- Компонент: `RevenueChart`
- Ссылка: Нет активных кнопок
- **Статус:** ✅ Display only

**2.2 Najbliższe sesje (Ближайшие сессии)**
```
├─ Title: "Najbliższe sesje"
├─ Right link: "Zobacz wszystkie →"
│  └─ href="/studio/calendar"
│  └─ **СТАТУС: ✅ РАБОТАЕТ**
└─ Session Rows (до 4)
   └─ Кликабельны на SessionRow компонент
   └─ href="/studio/sesja/{bookingId}"
   └─ **СТАТУС: ✅ РАБОТАЕТ**
```

---

#### **3. RIGHT COLUMN**

**3.1 Skrzynka działań (Inbox)**
```
├─ Title: "Skrzynka działań"
├─ Right link (если есть tasks):
│  └─ href="/studio/bookings"
│  └─ **СТАТУС: ✅ РАБОТАЕТ**
└─ Inbox items (pending, reschedule, unfinalized)
```

**3.2 Szybkie akcje (Quick Actions) — 4 КНОПКИ**

| Кнопка | href | Компонент | Статус |
|--------|------|-----------|--------|
| 📝 Dodaj sesję | `/studio/calendar?new=1` | QuickActionBtn | ✅ РАБОТАЕТ |
| 👥 Dodaj klienta | `/studio/klienci` | QuickActionBtn | ✅ РАБОТАЕТ |
| 🏠 Edytuj profil | `/studio/design` | QuickActionBtn | ✅ РАБОТАЕТ |
| 📦 Nowy pakiet | `/studio/design#packages` | QuickActionBtn | ⚠️ ЯКОРЬ |

**3.3 Ostatnie wiadomości (Recent messages)**
```
├─ Title: "Ostatnie wiadomości"
├─ Right link:
│  └─ href="/studio/messages"
│  └─ **СТАТУС: ✅ РАБОТАЕТ**
└─ Message Rows (до 4)
   └─ Кликабельны на MessageRow
   └─ href="/studio/messages?selected={messageId}"
   └─ **СТАТУС: ❓ ТРЕБУЕТ ПРОВЕРКИ**
```

**3.4 Nowe opinie · czekają na odpowiedź**
```
├─ Title: "Nowe opinie · czekają na odpowiedź"
├─ Review Cards (до 2)
└─ Кликабельны:
   └─ href="/studio/reviews"
   └─ **СТАТУС: ✅ РАБОТАЕТ**
```

---

## 2. НАВИГАЦИЯ (SIDEBAR + NAV-ITEMS)

### Структура (из `nav-items.tsx`)

```
📌 STUDIO_NAV — 5 основных входов в группе "top":

1. Pulpit (/studio)
   ├─ href: "/studio"
   ├─ match: p === "/studio" || p.startsWith("/studio/bookings")
   ├─ **СТАТУС: ✅ НАСТРОЕН**
   └─ (bookings входит как sub-context)

2. Kalendarz (/studio/calendar)
   ├─ href: "/studio/calendar"
   ├─ match: p.startsWith("/studio/calendar") || p.startsWith("/studio/availability")
   ├─ subItems:
   │  └─ Dostępność: ?mode=pattern
   │     └─ **СТАТУС: ✅ НАСТРОЕН**
   └─ **СТАТУС: ✅ РАБОТАЕТ**

3. Klienci (/studio/klienci)
   ├─ href: "/studio/klienci"
   ├─ match: p.startsWith("/studio/klienci") || p.startsWith("/studio/messages")
   ├─ subItems:
   │  └─ Wiadomości: /studio/messages
   │     └─ **СТАТУС: ✅ НАСТРОЕН**
   └─ **СТАТУС: ✅ РАБОТАЕТ**

4. Profil (/studio/profile)
   ├─ href: "/studio/profile"
   ├─ match: startsWith("/studio/profile") || "/studio/reviews" || "/studio/kupony"
   ├─ subItems:
   │  ├─ Kupony: /studio/kupony
   │  └─ Opinie: /studio/reviews
   │     └─ **СТАТУС: ✅ НАСТРОЕНЫ**
   └─ **СТАТУС: ✅ РАБОТАЕТ**

5. Design stron (/studio/design)
   ├─ href: "/studio/design"
   ├─ match: startsWith("/studio/design") || "/studio/uslugi" || "/studio/services" || "/studio/packages"
   ├─ **СТАТУС: ✅ РАБОТАЕТ**
   └─ (Usługi/packages скрыты, но маршруты доступны)
```

---

## 3. ДЕТАЛЬНЫЙ АУДИТ КНОПОК ПО СТРАНИЦЕ

### `/studio/klienci` (Klienci page)

**Найдено в коде:**
```tsx
// Button 1: "Uzupełnij portfel" (Fill wallet)
<button type="button" className="...">
  Uzupełnij portfel
</button>
❌ ПРОБЛЕМА: onClick не указан, это неработающая кнопка!

// Button 2: "Dodaj klienta" (Add client)
<button type="button" className="...">
  + Dodaj klienta
</button>
❌ ПРОБЛЕМА: onClick не указан, это неработающая кнопка!

// Client rows (clickable cards)
<ClientCard {...} />
❓ ТРЕБУЕТ ПРОВЕРКИ: есть ли onClick обработчик?
```

---

### `/studio/design` (Design page)

**Структура:**
- Tabs для редактирования профиля (содержание, услуги, пакеты)
- Якорь `#packages` используется в quick-action кнопке

**Статус:**
- ✅ Маршрут существует
- ❓ Якорь `#packages` требует проверки навигации внутри страницы

---

### `/studio/calendar` (Calendar)

**Режимы:**
- `/studio/calendar` — основной (бронирования)
- `/studio/calendar?mode=pattern` — Dostępność (расписание)
- `/studio/calendar?new=1` — создание новой сессии

**Статус:**
- ✅ Маршрут существует
- ✅ Query params обработаны
- ✅ Кнопка "Dodaj sesję" ведёт на `/studio/calendar?new=1`

---

### `/studio/messages` (Wiadomości)

**Статус:**
- ✅ Маршрут существует
- ❓ Message rows требуют проверки clickability

---

## 4. НАЙДЕННЫЕ ПРОБЛЕМЫ

### 🔴 КРИТИЧЕСКИЕ

1. **Klienci page — две неработающие кнопки**
   - "Uzupełnij portfel" (Fill wallet)
   - "Dodaj klienta" (Add client)
   - **Причина:** Нет onClick обработчика
   - **Решение:** Нужно добавить обработчик или сделать Link

2. **Якорь в quick-action кнопке**
   - `/studio/design#packages` может не работать
   - **Требует тестирования**

### 🟡 ТРЕБУЕТ ПРОВЕРКИ

1. Message rows в "/studio/messages" — есть ли клики?
2. Client cards на странице klienci — есть ли клики?
3. Review cards — правильная ли навигация?

---

## 5. ДОРОЖНАЯ КАРТА ИСПРАВЛЕНИЙ

```
[ ] Исправить две кнопки на странице /studio/klienci
[ ] Проверить якорь #packages на /studio/design
[ ] Проверить клики на message rows
[ ] Проверить клики на client cards
[ ] Проверить клики на review cards
[ ] Выполнить е2е тесты всех маршрутов
[ ] Перепроверить all href paths
```

---

## 6. ИТОГОВАЯ ТАБЛИЦА СТАТУСОВ

| Страница | Компонент | Статус | Примечание |
|----------|-----------|--------|-----------|
| /studio | KPI Cards | ✅ | Display only |
| /studio | Chart | ✅ | Display only |
| /studio | Sessions link | ✅ | /studio/calendar |
| /studio | Inbox link | ✅ | /studio/bookings |
| /studio | Dodaj sesję | ✅ | /studio/calendar?new=1 |
| /studio | Dodaj klienta | ✅ | /studio/klienci |
| /studio | Edytuj profil | ✅ | /studio/design |
| /studio | Nowy pakiet | ⚠️ | /studio/design#packages |
| /studio | Messages link | ✅ | /studio/messages |
| /studio | Reviews link | ✅ | /studio/reviews |
| /studio/klienci | Uzupełnij portfel | ❌ | Нет onClick |
| /studio/klienci | Dodaj klienta | ❌ | Нет onClick |
| /studio/messages | Message rows | ❓ | Требует проверки |
| /studio/design | Содержимое | ✅ | Якорь требует проверки |

---

## 7. ДОКУМЕНТАЦИЯ И ТРЕБОВАНИЯ

**Источники:**
- `landing-v2-spec.md` — описывает маршруты для клиентов, не тренеров
- `studio/page.tsx` — основная логика dashboard
- `studio/nav-items.tsx` — конфигурация навигации
- `studio/klienci/page.tsx` — страница управления клиентами

**В документации найдено:**
- ✅ Требуется функциональная навигация между страницами
- ✅ Все кнопки должны быть работающими
- ⚠️ Конкретные требования к дизайну есть в HTML файлах (35-studio-klienci-olx-style.html и т.д.)

