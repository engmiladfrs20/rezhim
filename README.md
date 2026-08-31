# NutriAI Persia

پلتفرم هوشمند پایش و تغذیه ایرانی با معماری پیشرفته **TypeScript Monorepo** مبتنی بر **Turborepo** و **pnpm**، به همراه سرورلس ابری **Cloudflare Workers (Hono)**، فضای ذخیره‌سازی **Backblaze B2** و پشتیبانی کامل دوجهته از خط و زبان فارسی و انگلیسی (**RTL/LTR**).

- **[x] Phase 1**: Monorepo Setup & CI Structuring
- **[x] Phase 2**: Cloudflare Workers API Foundation & Data Layer Setup
- **[x] Phase 3**: Authentication and Roles Foundation
- **[x] Phase 4**: Comprehensive Food Catalog Data Foundation
- **[x] Phase 5**: Iranian Food Catalog and Provenance Pipeline
- **[x] Phase 6**: Deterministic Nutrition Engine & Energy Calculations
- **[x] Phase 7**: Bilingual Food Search & Discovery
- **[x] Phase 8**: Authenticated Food Diary & Daily Nutrition Summaries
- **[x] Phase 9**: Deterministic Meal Plan Engine
- **[x] Phase 10**: Deterministic Food Substitution
- **[x] Phase 11**: Gemini AI Provider Gateway
- **[x] Phase 12**: AI Coach with Diary Context
- **[x] Phase 13**: Photo Food Recognition Boundary
- **[x] Phase 14**: Voice/Text Food Log Interpretation
- **[x] Phase 15**: Barcode Food Lookup Boundary
- **[x] Phase 16**: Authenticated Backblaze B2 Signed Storage URLs

---

## ۱. ساختار Monorepo

```text
├── apps/
│   ├── web/           # سامانه وب React 18 + Vite + Tailwind (پوسته اصلی کاربر)
│   ├── admin/         # پنل مدیریت React 18 + Vite (پوسته ایزوله ادمین)
│   └── mobile/        # اپلیکیشن موبایل React Native + Expo (پشتیبانی کامل از اندروید و RTL)
├── data/
│   └── sources/       # مخزن داده‌های پایه غذاهای ایرانی و الگوهای Ingestion
├── workers/
│   ├── api/           # وب‌سرویس REST مبتنی بر Cloudflare Workers و فریم‌ورک Hono
│   └── ai-jobs/       # پردازشگر صف‌های هوش مصنوعی (اجرای پس‌زمینه در فازهای بعد)

├── packages/
│   ├── config/        # تنظیمات اشتراکی TSConfig، ESLint و Prettier
│   ├── types/         # تایپ‌های اشتراکی دامنه، API، Storage و Cloudflare
│   ├── schemas/       # اسکیمای اعتبارسنجی Zod برای متغیرهای محیطی، سلامت و فایل‌ها
│   ├── nutrition/      # موتور محاسبات تغذیه، کالری، BMR، TDEE و جمع ارزش غذایی
│   ├── ai/             # قرارداد و دروازه سروری ارائه‌دهنده Gemini
│   ├── localization/  # دیکشنری‌های fa/en، ساختار RTL و فرمت‌کننده‌های Intl
│   ├── storage/       # رابط StorageProvider و ارائه‌دهنده Backblaze B2 S3 API
│   └── testing/       # ابزارها و ماک‌های تست
├── docs/              # مستندات تصمیمات معماری (ADR) و استراتژی‌ها
└── .github/workflows/ # فرآیندهای یکپارچه‌سازی و استقرار مداوم (CI/CD)
```

---

## ۲. پیش‌نیازها و نصب وابستگی‌ها

- **Node.js**: `22`
- **pnpm**: `9.15.9` (`packageManager: "pnpm@9.15.9"`)

```bash
# فعال‌سازی پکیج‌منیجر از طریق Corepack
corepack enable

# نصب وابستگی‌ها با Lockfile یکپارچه
pnpm install --frozen-lockfile
```

---

## ۳. دستورات اجرایی و تست‌ها

تمامی دستورات از ریشه مخزن توسط Turborepo مدیریت می‌شوند:

```bash
# 1. Install with frozen lockfile
pnpm install --frozen-lockfile

# 2. Format check
pnpm format:check

# 3. Lint
pnpm lint

# 4. Typecheck
pnpm typecheck

# 5. Tests with coverage
pnpm test:coverage

# 6. Dataset validation & integrity
pnpm data:validate

# 7. Dataset dry-run simulation
pnpm data:dry-run

# 8. Local D1 database ingestion
pnpm data:import:local

# 9. Build all workspaces
pnpm build

# 10. Dependency audit
pnpm audit --prod --audit-level=critical
```

---

## ۴. امنیت، ذخیره‌سازی و سرویس‌ها

- **Cloudflare Workers**: مسیر `GET /health` وضعیت سرویس را با امنیت بالا و بدون افشای سکرت‌ها برمی‌گرداند.
- **جست‌وجوی غذا**: `GET /api/v1/foods?q=...` و مسیر مدیریتی متن فارسی/انگلیسی، alias، برند و بارکد را با نرمال‌سازی قطعی جست‌وجو می‌کنند.
- **دفترچه غذایی**: `GET/POST /api/v1/diary` و `PATCH/DELETE /api/v1/diary/:id` رکوردهای خصوصی کاربر و جمع روزانه‌ی تغذیه را با همان موتور قطعی محاسبه می‌کنند.
- **برنامه غذایی**: `POST /api/v1/meal-plans/generate` با استفاده از اهداف تغذیه‌ای و غذاهای فعالِ دارای منشأ معتبر، چهار وعده‌ی روزانه‌ی قطعی تولید می‌کند.
- **جایگزینی غذا**: `POST /api/v1/substitutions` گزینه‌های فعال و دارای منشأ را بر اساس شباهت کالری و ماکرو، به‌صورت قطعی رتبه‌بندی می‌کند.
- **دروازه هوش مصنوعی**: `POST /api/v1/ai/generate` فقط در Worker و پس از احراز هویت به Gemini متصل می‌شود؛ در نبود کلید، پاسخ امن ۵۰۳ می‌دهد.
- **مربی هوش مصنوعی**: `POST /api/v1/ai/coach` با احراز هویت، جمع تغذیه روزانه کاربر را از دفترچه غذایی می‌خواند، اهداف را سمت سرور محاسبه می‌کند و پرسش را با دستورهای ایمنی ثابت به Gemini می‌فرستد؛ هیچ شناسه یا داده حساس کاربر وارد prompt نمی‌شود.
- **تشخیص غذای تصویری**: `POST /api/v1/ai/food-recognition` تصویر JPEG/PNG/WebP را با سقف ۳ مگابایت و فقط از مسیر احراز هویت‌شده به Gemini Vision می‌فرستد؛ تصویر ذخیره نمی‌شود و نتیجه تقریبی همراه disclaimer برمی‌گردد.
- **ثبت غذا با متن/صدا**: `POST /api/v1/ai/food-log` متن تایپ‌شده یا transcript صوتی را به فهرست قابل‌تأیید تبدیل می‌کند؛ هیچ رکوردی خودکار در دفترچه نوشته نمی‌شود و مقدار تغذیه‌ای از متن حدس زده نمی‌شود.
- **اسکن بارکد غذا**: `GET /api/v1/foods/barcode/:barcode` ارقام فارسی/عربی و جداکننده‌ها را نرمال می‌کند، فقط غذای active را با locale درخواستی برمی‌گرداند و برای بارکد نامعتبر یا ناشناخته پاسخ پایدار می‌دهد.
- **فضای ذخیره‌سازی امن**: `POST /api/v1/storage/signed-upload-url` و `POST /api/v1/storage/signed-download-url` فقط برای کاربر احراز‌شده و کلیدهای `user-uploads/{userId}/...` امضای کوتاه‌مدت صادر می‌کنند؛ ACL آپلود همیشه خصوصی است و staging/production بدون تنظیم B2 fail-closed می‌شوند.
- **Backblaze B2**: رابط `StorageProvider` پیاده‌سازی شده و از طریق API سازگار با S3 با Web Streams و `Uint8Array` ارتباط برقرار می‌کند.
- **RTL/LTR**: مدیریت کامل جهت و زبان در وب (`html[lang]` و `html[dir]`) و موبایل (`I18nManager.forceRTL`).

مستندات تکمیلی در پوشه `docs/` در دسترس است.

## 5. Security & Audit Policy

We run a strict dependency audit in CI to prevent vulnerable dependencies. The mandated severity policy is to fail on **critical** vulnerabilities.

We currently have 0 Critical and 2 documented High vulnerability advisories allowed by policy under `docs/SECURITY.md`. Critical advisories fail CI automatically.

For verification, run:
`pnpm audit --prod --audit-level=critical`
