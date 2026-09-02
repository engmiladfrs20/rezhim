import { useMemo, useState } from 'react';
import type { FC } from 'react';
import {
  BarChart3,
  BrainCircuit,
  ClipboardList,
  CookingPot,
  Database,
  Dumbbell,
  Leaf,
  PackageOpen,
  Play,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Utensils,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiRequest, formatJson, type ApiMethod } from '../api/client';

type EndpointDefinition = {
  id: string;
  label: string;
  method: ApiMethod;
  path: string;
  description: string;
  body?: Record<string, unknown>;
};

type FeatureGroup = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  endpoints: EndpointDefinition[];
};

const today = new Date().toISOString().slice(0, 10);

const groups: FeatureGroup[] = [
  {
    id: 'foods',
    label: 'غذا و جست‌وجو',
    description: 'جست‌وجوی غذای فعال، بارکد، دسته‌بندی و فهرست ریزمغذی‌ها.',
    icon: Search,
    endpoints: [
      {
        id: 'foods-list',
        label: 'فهرست غذاهای فعال',
        method: 'GET',
        path: '/api/v1/foods?locale=fa&limit=20',
        description: 'دریافت غذاهای قابل استفاده در برنامه و دفترچه غذایی.',
      },
      {
        id: 'foods-search',
        label: 'جست‌وجوی غذا',
        method: 'GET',
        path: '/api/v1/foods?locale=fa&q=عدس&limit=20',
        description: 'جست‌وجو با نام فارسی، انگلیسی یا نام مستعار.',
      },
      {
        id: 'foods-barcode',
        label: 'جست‌وجو با بارکد',
        method: 'GET',
        path: '/api/v1/foods/barcode/00000000?locale=fa',
        description: 'استعلام غذای تجاری با بارکد استاندارد.',
      },
      {
        id: 'food-detail',
        label: 'جزئیات غذا',
        method: 'GET',
        path: '/api/v1/foods/food-id?locale=fa',
        description: 'نمایش ترجمه‌ها، servingها و ارزش غذایی غذای فعال.',
      },
      {
        id: 'categories',
        label: 'دسته‌بندی‌ها',
        method: 'GET',
        path: '/api/v1/food-categories?locale=fa',
        description: 'دسته‌بندی‌های غذا برای فیلتر و انتخاب.',
      },
      {
        id: 'nutrients',
        label: 'تعریف ریزمغذی‌ها',
        method: 'GET',
        path: '/api/v1/nutrients',
        description: 'فهرست واحدها و شناسه‌های مواد مغذی.',
      },
    ],
  },
  {
    id: 'platform',
    label: 'زیرساخت و امنیت',
    description: 'بررسی آمادگی سامانه و عملیات نشست کاربر.',
    icon: ShieldCheck,
    endpoints: [
      {
        id: 'system',
        label: 'متادیتای سیستم',
        method: 'GET',
        path: '/api/v1/system',
        description: 'نسخه سرویس، محیط و آخرین migration.',
      },
      {
        id: 'ready',
        label: 'آمادگی سرویس',
        method: 'GET',
        path: '/ready',
        description: 'بررسی اتصال D1 و آمادگی Worker.',
      },
      {
        id: 'logout-all',
        label: 'خروج از همه نشست‌ها',
        method: 'POST',
        path: '/api/v1/auth/logout-all',
        description: 'لغو همه نشست‌های فعال کاربر.',
        body: {},
      },
      {
        id: 'token',
        label: 'توکن موبایل',
        method: 'POST',
        path: '/api/v1/auth/token',
        description: 'صدور توکن Bearer برای کلاینت‌های موبایل.',
        body: { email: 'RE-ENTER-EMAIL', password: 'RE-ENTER-PASSWORD' },
      },
    ],
  },
  {
    id: 'nutrition',
    label: 'تغذیه و دفترچه',
    description: 'محاسبه هدف، تجمیع مواد غذایی و ثبت وعده‌های روزانه.',
    icon: Utensils,
    endpoints: [
      {
        id: 'targets',
        label: 'محاسبه اهداف روزانه',
        method: 'POST',
        path: '/api/v1/nutrition/targets',
        description: 'محاسبه BMR، TDEE، کالری و ماکروها.',
        body: {
          gender: 'male',
          age: 30,
          heightCm: 175,
          weightKg: 80,
          bodyFatPercentage: null,
          lifeStage: 'adult_non_pregnant_non_lactating',
          activityLevel: 'moderately_active',
          dietGoal: 'maintenance',
          formula: 'mifflin_st_jeor',
        },
      },
      {
        id: 'aggregate',
        label: 'تجمیع ارزش غذایی',
        method: 'POST',
        path: '/api/v1/nutrition/aggregate',
        description: 'جمع کالری، ماکروها و ریزمغذی‌های چند غذا.',
        body: { items: [{ foodId: 'food-id', grams: 100 }] },
      },
      {
        id: 'diary-list',
        label: 'دفترچه غذایی امروز',
        method: 'GET',
        path: `/api/v1/diary?date=${today}&locale=fa`,
        description: 'نمایش وعده‌ها و جمع تغذیه روز.',
      },
      {
        id: 'diary-create',
        label: 'ثبت وعده غذایی',
        method: 'POST',
        path: '/api/v1/diary',
        description: 'ثبت غذا با گرم یا واحد serving.',
        body: {
          food_id: 'food-id',
          meal_type: 'lunch',
          grams: 100,
          eaten_at: new Date().toISOString(),
        },
      },
      {
        id: 'diary-delete',
        label: 'حذف وعده',
        method: 'DELETE',
        path: '/api/v1/diary/entry-id',
        description: 'حذف یک رکورد از دفترچه غذایی.',
      },
      {
        id: 'diary-update',
        label: 'ویرایش وعده',
        method: 'PATCH',
        path: '/api/v1/diary/entry-id',
        description: 'اصلاح مقدار یا نوع وعده با شناسه رکورد.',
        body: { grams: 120, meal_type: 'lunch' },
      },
    ],
  },
  {
    id: 'planning',
    label: 'برنامه و دستور غذا',
    description: 'ساخت برنامه غذایی، جایگزین هوشمند و محاسبه دستور.',
    icon: CookingPot,
    endpoints: [
      {
        id: 'meal-plan',
        label: 'تولید برنامه غذایی',
        method: 'POST',
        path: '/api/v1/meal-plans/generate',
        description: 'تولید برنامه یک تا چهارده روزه بر اساس اهداف.',
        body: {
          targets: {
            gender: 'male',
            age: 30,
            heightCm: 175,
            weightKg: 80,
            bodyFatPercentage: null,
            lifeStage: 'adult_non_pregnant_non_lactating',
            activityLevel: 'moderately_active',
            dietGoal: 'maintenance',
            formula: 'mifflin_st_jeor',
          },
          food_ids: ['food-1', 'food-2', 'food-3', 'food-4'],
          days: 1,
          locale: 'fa',
        },
      },
      {
        id: 'substitution',
        label: 'پیشنهاد جایگزین',
        method: 'POST',
        path: '/api/v1/substitutions',
        description: 'پیدا کردن غذاهای هم‌ارزش با حفظ محدودیت‌ها.',
        body: {
          food_id: 'food-id',
          grams: 100,
          candidate_food_ids: ['candidate-1', 'candidate-2'],
          limit: 5,
        },
      },
      {
        id: 'recipe',
        label: 'محاسبه دستور غذا',
        method: 'POST',
        path: '/api/v1/recipes/calculate',
        description: 'محاسبه ارزش غذایی کل و هر وعده.',
        body: {
          ingredients: [{ food_id: 'food-id', grams: 100 }],
          yield_grams: 100,
          servings: 1,
        },
      },
    ],
  },
  {
    id: 'ai',
    label: 'هوش مصنوعی',
    description: 'تولید متن، مربی تغذیه، تفسیر متن و تشخیص تصویر غذا.',
    icon: BrainCircuit,
    endpoints: [
      {
        id: 'ai-generate',
        label: 'تولید پاسخ AI',
        method: 'POST',
        path: '/api/v1/ai/generate',
        description: 'ارسال prompt به provider فعال.',
        body: {
          prompt: 'یک پیشنهاد کوتاه برای صبحانه سالم فارسی بده.',
          max_output_tokens: 256,
          temperature: 0.2,
        },
      },
      {
        id: 'ai-coach',
        label: 'سؤال از مربی',
        method: 'POST',
        path: '/api/v1/ai/coach',
        description: 'پاسخ مربی با توجه به اهداف و دفترچه همان روز.',
        body: {
          question: 'امروز برای رسیدن به هدفم چه چیزی کم دارم؟',
          date: today,
          locale: 'fa',
          biometrics: {
            gender: 'male',
            age: 30,
            heightCm: 175,
            weightKg: 80,
            bodyFatPercentage: null,
            lifeStage: 'adult_non_pregnant_non_lactating',
            activityLevel: 'moderately_active',
            dietGoal: 'maintenance',
            formula: 'mifflin_st_jeor',
          },
        },
      },
      {
        id: 'ai-food-log',
        label: 'ثبت غذا از متن',
        method: 'POST',
        path: '/api/v1/ai/food-log',
        description: 'تفسیر متن فارسی و پیشنهاد رکوردهای دفترچه.',
        body: { transcript: 'ظهر یک کاسه عدس پلو خوردم', date: today, locale: 'fa' },
      },
      {
        id: 'ai-recognition',
        label: 'تشخیص تصویر غذا',
        method: 'POST',
        path: '/api/v1/ai/food-recognition',
        description: 'ارسال base64 تصویر؛ مقدار تغذیه‌ای حدس زده نمی‌شود.',
        body: { image_base64: 'PASTE_BASE64_IMAGE_DATA', mime_type: 'image/jpeg', locale: 'fa' },
      },
    ],
  },
  {
    id: 'lifestyle',
    label: 'آب، روزه و عادت‌ها',
    description: 'مدیریت آب، جلسات روزه و عادت‌های روزانه.',
    icon: Leaf,
    endpoints: [
      {
        id: 'lifestyle-summary',
        label: 'خلاصه امروز',
        method: 'GET',
        path: `/api/v1/lifestyle/summary?date=${today}`,
        description: 'خلاصه آب، روزه و عادت‌های روز جاری.',
      },
      {
        id: 'water-list',
        label: 'سوابق آب',
        method: 'GET',
        path: `/api/v1/lifestyle/water?date=${today}`,
        description: 'فهرست تمام ورودی‌های آب روز.',
      },
      {
        id: 'water-create',
        label: 'ثبت آب',
        method: 'POST',
        path: '/api/v1/lifestyle/water',
        description: 'ثبت مقدار آب با زمان مصرف.',
        body: { amount_ml: 250, consumed_at: new Date().toISOString() },
      },
      {
        id: 'fasting-list',
        label: 'سوابق روزه',
        method: 'GET',
        path: `/api/v1/lifestyle/fasting?date=${today}`,
        description: 'نمایش جلسات روزه برای روز انتخاب‌شده.',
      },
      {
        id: 'fasting-start',
        label: 'شروع روزه',
        method: 'POST',
        path: '/api/v1/lifestyle/fasting/start',
        description: 'شروع جلسه روزه با هدف یک تا ۱۶۸ ساعت.',
        body: { goal_hours: 16, started_at: new Date().toISOString() },
      },
      {
        id: 'fasting-stop',
        label: 'پایان روزه',
        method: 'POST',
        path: '/api/v1/lifestyle/fasting/session-id/stop',
        description: 'پایان جلسه روزه با شناسه جلسه.',
      },
      {
        id: 'habits-list',
        label: 'فهرست عادت‌ها',
        method: 'GET',
        path: `/api/v1/lifestyle/habits?date=${today}`,
        description: 'نمایش عادت‌های ثبت‌شده.',
      },
      {
        id: 'habit-create',
        label: 'ثبت عادت',
        method: 'POST',
        path: '/api/v1/lifestyle/habits',
        description: 'ثبت وضعیت یک عادت برای تاریخ مشخص.',
        body: { habit_key: 'walk_30_min', occurred_on: today, completed: true, note: null },
      },
      {
        id: 'habit-update',
        label: 'ویرایش عادت',
        method: 'PATCH',
        path: '/api/v1/lifestyle/habits/habit-id',
        description: 'تغییر وضعیت یا یادداشت عادت.',
        body: { completed: false, note: 'امروز انجام نشد' },
      },
      {
        id: 'habit-delete',
        label: 'حذف عادت',
        method: 'DELETE',
        path: '/api/v1/lifestyle/habits/habit-id',
        description: 'حذف گزارش عادت.',
      },
    ],
  },
  {
    id: 'inventory',
    label: 'انبار و خرید',
    description: 'مدیریت pantry، یخچال، فریزر و فهرست خرید.',
    icon: ShoppingBasket,
    endpoints: [
      {
        id: 'pantry-list',
        label: 'فهرست انبار',
        method: 'GET',
        path: '/api/v1/pantry?location=pantry',
        description: 'نمایش اقلام انبار، یخچال یا فریزر.',
      },
      {
        id: 'pantry-create',
        label: 'افزودن به انبار',
        method: 'POST',
        path: '/api/v1/pantry',
        description: 'ثبت مقدار و محل نگهداری غذا.',
        body: {
          food_id: 'food-id',
          location: 'pantry',
          quantity_grams: 500,
          expires_at: null,
          note: null,
        },
      },
      {
        id: 'shopping-list',
        label: 'فهرست خرید',
        method: 'GET',
        path: '/api/v1/shopping-list?status=planned',
        description: 'نمایش اقلام برنامه‌ریزی‌شده یا خریداری‌شده.',
      },
      {
        id: 'shopping-create',
        label: 'افزودن به خرید',
        method: 'POST',
        path: '/api/v1/shopping-list',
        description: 'افزودن غذا و مقدار موردنیاز به فهرست خرید.',
        body: {
          food_id: 'food-id',
          required_grams: 500,
          purchased_grams: 0,
          status: 'planned',
          note: null,
        },
      },
      {
        id: 'pantry-update',
        label: 'ویرایش انبار',
        method: 'PATCH',
        path: '/api/v1/pantry/item-id',
        description: 'اصلاح مقدار یا محل نگهداری.',
        body: { quantity_grams: 750, location: 'fridge' },
      },
      {
        id: 'pantry-delete',
        label: 'حذف از انبار',
        method: 'DELETE',
        path: '/api/v1/pantry/item-id',
        description: 'حذف قلم انبار.',
      },
      {
        id: 'shopping-update',
        label: 'ویرایش فهرست خرید',
        method: 'PATCH',
        path: '/api/v1/shopping-list/item-id',
        description: 'به‌روزرسانی مقدار یا وضعیت خرید.',
        body: { purchased_grams: 250, status: 'purchased' },
      },
      {
        id: 'shopping-delete',
        label: 'حذف از فهرست خرید',
        method: 'DELETE',
        path: '/api/v1/shopping-list/item-id',
        description: 'حذف قلم خرید.',
      },
    ],
  },
  {
    id: 'progress',
    label: 'پیشرفت و اشتراک',
    description: 'وزن، روند پیشرفت، اشتراک و لینک‌های امن ذخیره‌سازی.',
    icon: BarChart3,
    endpoints: [
      {
        id: 'weight-trend',
        label: 'روند وزن',
        method: 'GET',
        path: '/api/v1/progress/weight/trend?limit=30',
        description: 'روند و تغییر وزن در ۳۰ رکورد اخیر.',
      },
      {
        id: 'weight-list',
        label: 'سوابق وزن',
        method: 'GET',
        path: '/api/v1/progress/weight?limit=30',
        description: 'فهرست رکوردهای وزن کاربر.',
      },
      {
        id: 'weight-create',
        label: 'ثبت وزن',
        method: 'POST',
        path: '/api/v1/progress/weight',
        description: 'ثبت وزن جدید با زمان اندازه‌گیری.',
        body: { weight_kg: 80, measured_at: new Date().toISOString() },
      },
      {
        id: 'weight-update',
        label: 'ویرایش وزن',
        method: 'PATCH',
        path: '/api/v1/progress/weight/entry-id',
        description: 'اصلاح رکورد وزن.',
        body: { weight_kg: 79.5 },
      },
      {
        id: 'weight-delete',
        label: 'حذف رکورد وزن',
        method: 'DELETE',
        path: '/api/v1/progress/weight/entry-id',
        description: 'حذف رکورد وزن.',
      },
      {
        id: 'subscription',
        label: 'وضعیت اشتراک',
        method: 'GET',
        path: '/api/v1/subscription',
        description: 'نمایش پلن و وضعیت فعلی اشتراک.',
      },
      {
        id: 'checkout',
        label: 'درخواست ارتقای اشتراک',
        method: 'POST',
        path: '/api/v1/subscription/checkout',
        description: 'در حال حاضر تا اتصال provider پرداخت، پاسخ 503 کنترل‌شده برمی‌گرداند.',
        body: { plan: 'pro' },
      },
      {
        id: 'signed-upload',
        label: 'لینک آپلود امن',
        method: 'POST',
        path: '/api/v1/storage/signed-upload-url',
        description: 'گرفتن URL امضاشده برای B2 با کلید محدود به کاربر.',
        body: {
          object_key: 'progress/example.jpg',
          content_type: 'image/jpeg',
          content_length: 1000,
          acl: 'private',
        },
      },
      {
        id: 'signed-download',
        label: 'لینک دانلود امن',
        method: 'POST',
        path: '/api/v1/storage/signed-download-url',
        description: 'گرفتن URL امضاشده برای خواندن فایل خصوصی.',
        body: { object_key: 'progress/example.jpg' },
      },
    ],
  },
];

const adminGroup: FeatureGroup = {
  id: 'admin',
  label: 'مدیریت',
  description: 'مدیریت کاربران، غذاها و آمار سامانه برای نقش مدیر.',
  icon: Dumbbell,
  endpoints: [
    {
      id: 'admin-analytics',
      label: 'آمار سامانه',
      method: 'GET',
      path: '/api/v1/admin/analytics/overview',
      description: 'تعداد کاربران، غذاها و ورودی‌های دفترچه.',
    },
    {
      id: 'admin-users',
      label: 'فهرست کاربران',
      method: 'GET',
      path: '/api/v1/admin/users?limit=50',
      description: 'فهرست کاربران با فیلتر نقش و وضعیت.',
    },
    {
      id: 'admin-user-detail',
      label: 'جزئیات کاربر',
      method: 'GET',
      path: '/api/v1/admin/users/user-id',
      description: 'مشاهده‌ی اطلاعات عمومی یک کاربر.',
    },
    {
      id: 'admin-user-status',
      label: 'تغییر وضعیت کاربر',
      method: 'PATCH',
      path: '/api/v1/admin/users/user-id/status',
      description: 'فعال یا غیرفعال‌کردن کاربر (به‌جز خود مدیر).',
      body: { status: 'disabled' },
    },
    {
      id: 'admin-foods',
      label: 'مدیریت غذاها',
      method: 'GET',
      path: '/api/v1/admin/foods?status=all&locale=fa&limit=20',
      description: 'فهرست غذاهای draft، active و archived.',
    },
    {
      id: 'admin-food-detail',
      label: 'جزئیات غذای مدیریت',
      method: 'GET',
      path: '/api/v1/admin/foods/food-id?locale=fa',
      description: 'جزئیات کامل غذا برای ویرایش مدیر.',
    },
    {
      id: 'admin-food-create',
      label: 'ساخت غذای جدید',
      method: 'POST',
      path: '/api/v1/admin/foods',
      description: 'ایجاد غذای جدید همراه ترجمه، nutrient و serving.',
      body: {
        type: 'generic',
        status: 'draft',
        translations: [{ locale: 'fa', name: 'غذای نمونه' }],
        nutrients: [],
        servings: [{ name: '100 گرم', grams: 100 }],
      },
    },
    {
      id: 'admin-food-update',
      label: 'ویرایش غذای مدیریت',
      method: 'PATCH',
      path: '/api/v1/admin/foods/food-id',
      description: 'ویرایش اطلاعات غذا بدون حذف رابطه‌های موجود.',
      body: { status: 'active' },
    },
    {
      id: 'admin-food-archive',
      label: 'بایگانی غذا',
      method: 'DELETE',
      path: '/api/v1/admin/foods/food-id',
      description: 'بایگانی نرم غذا از API عمومی.',
    },
    {
      id: 'admin-categories',
      label: 'دسته‌بندی‌های مدیریت',
      method: 'GET',
      path: '/api/v1/admin/foods/categories',
      description: 'دسته‌بندی‌های مدیریتی غذا.',
    },
    {
      id: 'admin-category-create',
      label: 'ساخت دسته‌بندی',
      method: 'POST',
      path: '/api/v1/admin/foods/categories',
      description: 'ساخت دسته‌بندی والد یا فرزند.',
      body: { slug: 'sample-category', translations: [{ locale: 'fa', name: 'دسته نمونه' }] },
    },
    {
      id: 'admin-sources',
      label: 'منابع داده',
      method: 'GET',
      path: '/api/v1/admin/foods/sources',
      description: 'منشأ و مجوز داده‌های غذایی.',
    },
  ],
};

function EndpointRunner({ endpoint }: { endpoint: EndpointDefinition }) {
  const [path, setPath] = useState(endpoint.path);
  const [bodyText, setBodyText] = useState(() => (endpoint.body ? formatJson(endpoint.body) : ''));
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      let body: unknown;
      if (endpoint.method === 'POST' || endpoint.method === 'PATCH') {
        body = JSON.parse(bodyText) as unknown;
      }
      const data = await apiRequest(path, { method: endpoint.method, body });
      setResult(data);
    } catch (cause: unknown) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'خطای ناشناخته در درخواست');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{endpoint.label}</h3>
          <p className="text-xs text-slate-600 mt-1">{endpoint.description}</p>
        </div>
        <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">
          {endpoint.method}
        </span>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        مسیر API
        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          dir="ltr"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
        />
      </label>
      {(endpoint.method === 'POST' || endpoint.method === 'PATCH') && (
        <label className="block text-xs font-medium text-slate-600">
          بدنه JSON
          <textarea
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            dir="ltr"
            rows={7}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-[11px] text-slate-800"
          />
        </label>
      )}
      <button
        type="button"
        onClick={run}
        disabled={loading || !path}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        <Play className="h-3.5 w-3.5" />
        {loading ? 'در حال اجرا...' : 'اجرا'}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      {result !== null && (
        <pre
          className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-3 text-[11px] leading-5 text-emerald-200"
          dir="ltr"
        >
          {formatJson(result)}
        </pre>
      )}
    </div>
  );
}

export const FeatureWorkspace: FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const availableGroups = useMemo(() => (isAdmin ? [...groups, adminGroup] : groups), [isAdmin]);
  const [activeGroupId, setActiveGroupId] = useState(availableGroups[0]?.id ?? 'foods');
  const activeGroup =
    availableGroups.find((group) => group.id === activeGroupId) ?? availableGroups[0];

  return (
    <section aria-label="Feature workspace" className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-emerald-600" />
        <div>
          <h2 className="text-lg font-bold text-slate-900">امکانات کامل سامانه</h2>
          <p className="text-xs text-slate-600 mt-1">
            تمام قابلیت‌های موجود در Worker از همین‌جا با نشست امن شما قابل مشاهده و اجراست.
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Feature groups">
        {availableGroups.map((group) => {
          const Icon = group.icon;
          const active = group.id === activeGroupId;
          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveGroupId(group.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {group.label}
            </button>
          );
        })}
      </div>

      {activeGroup && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <Database className="h-4 w-4" />
            {activeGroup.label}
          </div>
          <p className="mt-1 text-xs text-emerald-800">{activeGroup.description}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {activeGroup.endpoints.map((endpoint) => (
              <EndpointRunner key={endpoint.id} endpoint={endpoint} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <ClipboardList className="mb-2 h-5 w-5 text-indigo-600" />
          دفترچه، اهداف و محاسبات تغذیه با API واقعی متصل هستند.
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <PackageOpen className="mb-2 h-5 w-5 text-sky-600" />
          انبار، خرید، ذخیره‌سازی B2 و لینک‌های امضاشده قابل آزمایش‌اند.
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <BarChart3 className="mb-2 h-5 w-5 text-violet-600" />
          پاسخ خام هر درخواست برای خطایابی و بررسی دقیق نمایش داده می‌شود.
        </div>
      </div>
    </section>
  );
};
