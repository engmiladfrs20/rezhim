import { useEffect, useMemo, useState } from 'react';
import type { FC, FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CalculatedNutritionTargets,
  DailyDiarySummary,
  FoodSummary,
  GeneratedMealPlan,
  PublicUser,
  PaginatedResult,
  UserNutritionGoal,
} from '@nutriai/types';
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  Droplets,
  Flame,
  HeartPulse,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
  Utensils,
  X,
} from 'lucide-react';
import { apiRequest, ApiClientError } from '../api/client';

type GoalForm = {
  gender: 'male' | 'female';
  age: string;
  heightCm: string;
  weightKg: string;
  activityLevel:
    'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
  dietGoal:
    | 'weight_loss_aggressive'
    | 'weight_loss_mild'
    | 'maintenance'
    | 'muscle_gain_mild'
    | 'muscle_gain_aggressive';
  formula: 'mifflin_st_jeor' | 'harris_benedict' | 'katch_mcardle';
  mealsPerDay: string;
  dietaryPreferences: string;
  allergies: string;
};

const defaultGoal: GoalForm = {
  gender: 'female',
  age: '30',
  heightCm: '165',
  weightKg: '70',
  activityLevel: 'moderately_active',
  dietGoal: 'weight_loss_mild',
  formula: 'mifflin_st_jeor',
  mealsPerDay: '4',
  dietaryPreferences: '',
  allergies: '',
};

const mealMeta = {
  breakfast: { fa: 'صبحانه', en: 'Breakfast', icon: '☀️', color: 'bg-amber-50 text-amber-700' },
  lunch: { fa: 'ناهار', en: 'Lunch', icon: '🍲', color: 'bg-emerald-50 text-emerald-700' },
  dinner: { fa: 'شام', en: 'Dinner', icon: '🌙', color: 'bg-indigo-50 text-indigo-700' },
  snack: { fa: 'میان‌وعده', en: 'Snack', icon: '🍎', color: 'bg-rose-50 text-rose-700' },
} as const;

const goalLabels: Record<GoalForm['dietGoal'], { fa: string; en: string; hint: string }> = {
  weight_loss_aggressive: {
    fa: 'کاهش وزن سریع',
    en: 'Fast weight loss',
    hint: 'کاهش پرشتاب، با پایش دقیق',
  },
  weight_loss_mild: {
    fa: 'کاهش وزن پایدار',
    en: 'Steady weight loss',
    hint: 'آرام، قابل‌دوام و محبوب‌ترین انتخاب',
  },
  maintenance: { fa: 'حفظ وزن فعلی', en: 'Maintain weight', hint: 'تعادل و انرژی روزانه' },
  muscle_gain_mild: {
    fa: 'عضله‌سازی',
    en: 'Build muscle',
    hint: 'پروتئین بیشتر و مازاد کنترل‌شده',
  },
  muscle_gain_aggressive: {
    fa: 'عضله‌سازی سریع',
    en: 'Fast muscle gain',
    hint: 'برای تمرین‌های سنگین',
  },
};

function readStoredGoal(userId: string): GoalForm | null {
  try {
    const value = localStorage.getItem(`nutriai.goal.${userId}`);
    return value
      ? ({ ...defaultGoal, ...(JSON.parse(value) as Partial<GoalForm>) } as GoalForm)
      : null;
  } catch {
    return null;
  }
}

function toRequest(form: GoalForm) {
  return {
    gender: form.gender,
    age: Number(form.age),
    heightCm: Number(form.heightCm),
    weightKg: Number(form.weightKg),
    activityLevel: form.activityLevel,
    dietGoal: form.dietGoal,
    formula: form.formula,
    lifeStage: 'adult_non_pregnant_non_lactating' as const,
    mealsPerDay: Number(form.mealsPerDay),
    dietaryPreferences: form.dietaryPreferences
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    allergies: form.allergies
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function fromPersistedGoal(goal: UserNutritionGoal): GoalForm {
  return {
    gender: goal.gender,
    age: String(goal.age),
    heightCm: String(goal.heightCm),
    weightKg: String(goal.weightKg),
    activityLevel: goal.activityLevel,
    dietGoal: goal.dietGoal,
    formula: goal.formula,
    mealsPerDay: String(goal.mealsPerDay),
    dietaryPreferences: goal.dietaryPreferences.join(', '),
    allergies: goal.allergies.join(', '),
  };
}

function number(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined || Number.isNaN(value)
    ? '—'
    : new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits }).format(value);
}

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  return error instanceof Error ? error.message : 'خطایی رخ داد. دوباره تلاش کنید.';
}

const GoalWizard: FC<{
  initial?: GoalForm | null;
  onComplete: (form: GoalForm) => void;
  busy: boolean;
  error?: string;
}> = ({ initial, onComplete, busy, error }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<GoalForm>(initial ?? defaultGoal);
  const update = <K extends keyof GoalForm>(key: K, value: GoalForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const isStepValid =
    step === 1
      ? Number(form.age) >= 19 && Number(form.heightCm) >= 50 && Number(form.weightKg) >= 20
      : true;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step < 3) setStep((value) => value + 1);
    else onComplete(form);
  };

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-5 py-7 text-white shadow-2xl sm:px-10 sm:py-10">
      <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative mx-auto max-w-3xl">
        <div className="mb-8 flex items-start justify-between gap-5">
          <div>
            <p className="mb-2 text-sm font-medium text-emerald-300">شروع هوشمند NutriAI</p>
            <h2 className="text-2xl font-black tracking-tight sm:text-4xl">
              برنامه‌ای که برای تو ساخته می‌شود
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
              چند سؤال کوتاه جواب بده تا کالری، درشت‌مغذی‌ها و وعده‌های روزانه‌ات را دقیق و
              قابل‌تغییر بسازیم.
            </p>
          </div>
          <div className="hidden rounded-2xl bg-white/10 p-3 sm:block">
            <Sparkles className="h-7 w-7 text-amber-300" />
          </div>
        </div>
        <div className="mb-8 flex items-center gap-2" aria-label="مراحل تنظیم هدف">
          {[1, 2, 3].map((item) => (
            <div key={item} className="flex flex-1 items-center gap-2">
              <div
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${step >= item ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-400'}`}
              >
                {step > item ? <Check className="h-4 w-4" /> : item}
              </div>
              {item < 3 && (
                <div
                  className={`h-1 flex-1 rounded-full ${step > item ? 'bg-emerald-400' : 'bg-white/10'}`}
                />
              )}
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-6">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="field-dark">
                <span>سن</span>
                <input
                  aria-label="سن"
                  type="number"
                  min="19"
                  max="120"
                  value={form.age}
                  onChange={(e) => update('age', e.target.value)}
                  required
                />
              </label>
              <label className="field-dark">
                <span>قد (سانتی‌متر)</span>
                <input
                  aria-label="قد"
                  type="number"
                  min="50"
                  max="260"
                  value={form.heightCm}
                  onChange={(e) => update('heightCm', e.target.value)}
                  required
                />
              </label>
              <label className="field-dark">
                <span>وزن فعلی (کیلوگرم)</span>
                <input
                  aria-label="وزن"
                  type="number"
                  min="20"
                  max="350"
                  step="0.1"
                  value={form.weightKg}
                  onChange={(e) => update('weightKg', e.target.value)}
                  required
                />
              </label>
              <div className="sm:col-span-3">
                <span className="mb-2 block text-sm text-slate-300">جنسیت</span>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ['female', 'خانم'],
                      ['male', 'آقا'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update('gender', value)}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${form.gender === value ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <span className="mb-2 block text-sm text-slate-300">هدف اصلی تو چیست؟</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(goalLabels) as GoalForm['dietGoal'][]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => update('dietGoal', value)}
                      className={`rounded-2xl border p-4 text-right transition ${form.dietGoal === value ? 'border-emerald-400 bg-emerald-400/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    >
                      <span className="block font-bold">{goalLabels[value].fa}</span>
                      <span className="mt-1 block text-xs text-slate-400">
                        {goalLabels[value].hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="field-dark">
                <span>میزان فعالیت روزانه</span>
                <select
                  value={form.activityLevel}
                  onChange={(e) =>
                    update('activityLevel', e.target.value as GoalForm['activityLevel'])
                  }
                >
                  <option value="sedentary">کم‌تحرک</option>
                  <option value="lightly_active">کمی فعال</option>
                  <option value="moderately_active">فعال متوسط</option>
                  <option value="very_active">خیلی فعال</option>
                  <option value="extra_active">ورزشکار حرفه‌ای</option>
                </select>
              </label>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field-dark">
                <span>تعداد وعده در روز</span>
                <select
                  value={form.mealsPerDay}
                  onChange={(e) => update('mealsPerDay', e.target.value)}
                >
                  <option value="3">۳ وعده</option>
                  <option value="4">۴ وعده</option>
                  <option value="5">۵ وعده</option>
                  <option value="6">۶ وعده</option>
                </select>
              </label>
              <label className="field-dark">
                <span>فرمول محاسبه</span>
                <select
                  value={form.formula}
                  onChange={(e) => update('formula', e.target.value as GoalForm['formula'])}
                >
                  <option value="mifflin_st_jeor">استاندارد Mifflin</option>
                  <option value="harris_benedict">Harris-Benedict</option>
                  <option value="katch_mcardle">Katch-McArdle</option>
                </select>
              </label>
              <label className="field-dark sm:col-span-2">
                <span>
                  غذاهای محبوب یا سبک غذایی <small>(اختیاری)</small>
                </span>
                <input
                  value={form.dietaryPreferences}
                  onChange={(e) => update('dietaryPreferences', e.target.value)}
                  placeholder="مثلاً غذای ایرانی، گیاهی، کم‌کربوهیدرات"
                />
              </label>
              <label className="field-dark sm:col-span-2">
                <span>
                  حساسیت یا غذایی که نمی‌خوری <small>(اختیاری)</small>
                </span>
                <input
                  value={form.allergies}
                  onChange={(e) => update('allergies', e.target.value)}
                  placeholder="مثلاً بادام‌زمینی، شیر"
                />
              </label>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              disabled={step === 1 || busy}
              onClick={() => setStep((value) => value - 1)}
              className="rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/10 disabled:invisible"
            >
              بازگشت
            </button>
            <button
              type="submit"
              disabled={!isStepValid || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300 disabled:opacity-50"
            >
              {busy ? 'در حال ساخت برنامه…' : step === 3 ? 'ساخت برنامه من' : 'ادامه'}
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export const UserDashboard: FC<{
  user: PublicUser;
  locale: 'fa' | 'en';
  onOpenSettings: () => void;
}> = ({ user, locale, onOpenSettings }) => {
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState<GoalForm | null>(() => readStoredGoal(user.id));
  const [targets, setTargets] = useState<CalculatedNutritionTargets | null>(null);
  const [plan, setPlan] = useState<GeneratedMealPlan | null>(null);
  const [wizardOpen, setWizardOpen] = useState(!goal);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSummary | null>(null);
  const [portion, setPortion] = useState('100');
  const [notice, setNotice] = useState('');
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const foods = useQuery({
    queryKey: ['foods', search],
    queryFn: () =>
      apiRequest<PaginatedResult<FoodSummary>>(
        `/api/v1/foods?locale=fa&limit=20${search ? `&q=${encodeURIComponent(search)}` : ''}`,
      ),
    enabled: Boolean(user),
    retry: false,
  });
  const persistedGoal = useQuery({
    queryKey: ['user-goal'],
    queryFn: () => apiRequest<{ goal: UserNutritionGoal | null }>('/api/v1/users/me/goals'),
    enabled: Boolean(user),
    retry: false,
  });
  const diary = useQuery({
    queryKey: ['diary', date],
    queryFn: () => apiRequest<DailyDiarySummary>(`/api/v1/diary?date=${date}&locale=fa`),
    enabled: Boolean(user),
    retry: false,
  });
  const buildPlan = useMutation({
    mutationFn: async (form: GoalForm) => {
      const input = toRequest(form);
      const calculated = await apiRequest<CalculatedNutritionTargets>('/api/v1/nutrition/targets', {
        method: 'POST',
        body: input,
      });
      const foodData =
        foods.data ??
        (await apiRequest<PaginatedResult<FoodSummary>>('/api/v1/foods?locale=fa&limit=20'));
      const candidates = foodData.items
        .map((food) => food.id)
        .filter(Boolean)
        .slice(0, 12);
      if (candidates.length < 4) throw new Error('برای ساخت برنامه حداقل چهار غذای فعال لازم است.');
      const generated = await apiRequest<GeneratedMealPlan>('/api/v1/meal-plans/generate', {
        method: 'POST',
        body: { targets: input, food_ids: candidates, days: 1, locale: 'fa' },
      });
      await apiRequest('/api/v1/users/me/goals', { method: 'PUT', body: input });
      return { form, calculated, generated };
    },
    onSuccess: ({ form, calculated, generated }) => {
      localStorage.setItem(`nutriai.goal.${user.id}`, JSON.stringify(form));
      setGoal(form);
      setTargets(calculated);
      setPlan(generated);
      setWizardOpen(false);
      setNotice('برنامهٔ اختصاصی تو آماده شد ✨');
    },
    onError: (error) => setNotice(errorMessage(error)),
  });
  const addDiary = useMutation({
    mutationFn: (food: FoodSummary) =>
      apiRequest('/api/v1/diary', {
        method: 'POST',
        body: {
          food_id: food.id,
          grams: Number(portion),
          meal_type: 'snack',
          consumed_at: new Date().toISOString(),
        },
      }),
    onSuccess: () => {
      setSelectedFood(null);
      setNotice('به دفترچهٔ غذایی امروز اضافه شد.');
      void queryClient.invalidateQueries({ queryKey: ['diary', date] });
    },
    onError: (error) => setNotice(errorMessage(error)),
  });
  const meals = plan?.days[0]?.meals ?? [];
  const consumed = diary.data?.nutrition;
  const calorieProgress =
    targets && consumed
      ? Math.min(100, Math.round((consumed.totalEnergyKcal / targets.targetCalories) * 100))
      : 0;

  useEffect(() => {
    if (!goal && persistedGoal.data?.goal) {
      const restored = fromPersistedGoal(persistedGoal.data.goal);
      setGoal(restored);
      setWizardOpen(false);
    }
  }, [goal, persistedGoal.data]);

  useEffect(() => {
    if (goal && foods.data && !targets && !buildPlan.isPending)
      buildPlan.mutate(goal); /* intentional one-time restore */
  }, [goal, foods.data, targets]);

  if (wizardOpen)
    return (
      <GoalWizard
        initial={goal}
        onComplete={(form) => buildPlan.mutate(form)}
        busy={buildPlan.isPending}
        error={notice}
      />
    );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-l from-emerald-600 via-teal-600 to-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="absolute -left-12 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm text-emerald-100">
              {new Date().toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              سلام {user.display_name.split(' ')[0]} 👋
            </h2>
            <p className="mt-2 text-sm text-emerald-50">
              امروز یک قدم کوچک به هدف بزرگت نزدیک‌تر شو.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <span className="block text-xs text-emerald-100">هدف امروز</span>
              <strong className="text-2xl">
                {number(targets?.targetCalories)}{' '}
                <small className="text-sm font-normal">کیلوکالری</small>
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
            >
              <RefreshCcw className="h-4 w-4" /> تغییر هدف
            </button>
          </div>
        </div>
      </section>
      {notice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          <button type="button" aria-label="بستن پیام" onClick={() => setNotice('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          label="کالری مصرف‌شده"
          value={`${number(consumed?.totalEnergyKcal)} kcal`}
          hint={`${calorieProgress}% از هدف امروز`}
          color="orange"
          progress={calorieProgress}
        />
        <StatCard
          icon={<HeartPulse className="h-5 w-5" />}
          label="پروتئین"
          value={`${number(consumed?.totalProteinGrams, 1)} g`}
          hint={`هدف ${number(targets?.macronutrients.proteinGrams, 1)} گرم`}
          color="violet"
        />
        <StatCard
          icon={<Droplets className="h-5 w-5" />}
          label="آب پیشنهادی"
          value={`${number(targets?.micronutrients.recommendedWaterMl)} ml`}
          hint="ردگیری از پایین صفحه"
          color="sky"
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          label="مسیر هدف"
          value={goal ? goalLabels[goal.dietGoal].fa : '—'}
          hint={`${goal?.mealsPerDay ?? 4} وعده در روز`}
          color="emerald"
        />
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                برنامهٔ امروز
              </p>
              <h3 className="mt-1 text-xl font-black text-slate-900">وعده‌هایت آماده‌اند</h3>
            </div>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
            >
              <RefreshCcw className="h-3.5 w-3.5" /> ساخت دوباره
            </button>
          </div>
          {buildPlan.isPending && (
            <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">
              در حال تنظیم برنامه بر اساس غذاهای معتبر…
            </div>
          )}
          {!buildPlan.isPending && meals.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center">
              <Utensils className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-bold text-slate-700">برنامه هنوز ساخته نشده</p>
              <button
                type="button"
                onClick={() => goal && buildPlan.mutate(goal)}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
              >
                ساخت برنامه
              </button>
            </div>
          )}
          {meals.map((meal) => {
            const meta = mealMeta[meal.mealType];
            const item = meal.nutrition.items[0];
            return (
              <article
                key={meal.mealType}
                className="group mb-3 flex flex-col gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 transition hover:border-emerald-200 hover:bg-white hover:shadow-md sm:flex-row sm:items-center"
              >
                <div
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl ${meta.color}`}
                >
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black text-slate-900">{meta.fa}</h4>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500">
                      {number(meal.nutrition.totalEnergyKcal)} kcal
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {item?.foodNameFa ?? 'غذای پیشنهادی'} · {number(item?.portionGrams)} گرم
                  </p>
                  <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
                    <span>پروتئین {number(meal.nutrition.totalProteinGrams, 1)}g</span>
                    <span>کربوهیدرات {number(meal.nutrition.totalCarbsGrams, 1)}g</span>
                    <span>چربی {number(meal.nutrition.totalFatGrams, 1)}g</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      item &&
                      setSelectedFood({
                        id: item.foodId,
                        name: item.foodNameFa,
                        description: null,
                        locale: 'fa',
                        resolvedLocale: 'fa',
                        foodType: 'generic',
                        brandName: null,
                        barcode: null,
                        status: 'active',
                        categoryId: null,
                        categoryName: null,
                        energyKcal: item.energyKcal,
                        proteinG: item.proteinGrams,
                        carbsG: item.carbsGrams,
                        fatG: item.fatGrams,
                        createdAt: '',
                        updatedAt: '',
                      })
                    }
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    ثبت وعده
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardOpen(true)}
                    className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
                    aria-label="تعویض غذا"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-violet-600">
                  ترکیب هدف
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900">تعادل روزانه</h3>
              </div>
              <Activity className="h-5 w-5 text-violet-500" />
            </div>
            <div className="space-y-4">
              <MacroBar
                label="پروتئین"
                value={targets?.macronutrients.proteinGrams}
                percent={targets?.macronutrients.proteinPercentage}
                color="bg-violet-500"
              />
              <MacroBar
                label="کربوهیدرات"
                value={targets?.macronutrients.carbsGrams}
                percent={targets?.macronutrients.carbsPercentage}
                color="bg-amber-500"
              />
              <MacroBar
                label="چربی"
                value={targets?.macronutrients.fatGrams}
                percent={targets?.macronutrients.fatPercentage}
                color="bg-rose-500"
              />
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500">
              این اعداد راهنمای عمومی هستند و جایگزین توصیهٔ پزشک یا متخصص تغذیه نیستند.
            </p>
          </section>
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-600">
                  جست‌وجوی سریع
                </p>
                <h3 className="mt-1 text-lg font-black text-slate-900">غذایت را پیدا کن</h3>
              </div>
              <Search className="h-5 w-5 text-sky-500" />
            </div>
            <div className="relative mt-4">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="مثلاً عدس، ماست، کباب…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white"
              />
              {searchOpen && (
                <div className="absolute inset-x-0 top-12 z-20 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {foods.isLoading ? (
                    <p className="p-3 text-xs text-slate-500">در حال جست‌وجو…</p>
                  ) : foods.data?.items.length ? (
                    foods.data.items.slice(0, 8).map((food) => (
                      <button
                        type="button"
                        key={food.id}
                        onClick={() => {
                          setSelectedFood(food);
                          setSearchOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-right text-sm hover:bg-emerald-50"
                      >
                        <span className="font-medium text-slate-800">{food.name}</span>
                        <span className="text-xs text-slate-400">
                          {number(food.energyKcal)} kcal/100g
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-xs text-slate-500">غذایی پیدا نشد</p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="mt-3 text-xs font-bold text-emerald-700"
            >
              مشاهدهٔ دفترچهٔ کامل غذاها <ArrowLeft className="inline h-3 w-3" />
            </button>
          </section>
          <section className="rounded-[1.75rem] bg-slate-900 p-5 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/20 text-amber-300">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black">همراه هم پیش می‌رویم</h3>
                <p className="mt-1 text-xs text-slate-300">
                  وزن و آب روزانه‌ات را ثبت کن تا روندت را ببینی.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-4 w-full rounded-xl border border-white/15 px-3 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10"
            >
              تنظیمات حساب و زبان
            </button>
          </section>
        </div>
      </div>
      {selectedFood && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="ثبت غذا"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-600">افزودن به دفترچه</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{selectedFood.name}</h3>
              </div>
              <button type="button" onClick={() => setSelectedFood(null)} aria-label="بستن">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <label className="mt-6 block text-sm font-bold text-slate-700">
              مقدار مصرف (گرم)
              <input
                type="number"
                min="1"
                max="2000"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-400"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedFood(null)}
                className="rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={addDiary.isPending}
                onClick={() => addDiary.mutate(selectedFood)}
                className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {addDiary.isPending ? 'در حال ثبت…' : 'ثبت در دفترچه'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: FC<{
  icon: JSX.Element;
  label: string;
  value: string;
  hint: string;
  color: 'orange' | 'violet' | 'sky' | 'emerald';
  progress?: number;
}> = ({ icon, label, value, hint, color, progress }) => {
  const colors = {
    orange: 'bg-orange-50 text-orange-600',
    violet: 'bg-violet-50 text-violet-600',
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[color]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-orange-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </article>
  );
};

const MacroBar: FC<{
  label: string;
  value: number | undefined;
  percent: number | undefined;
  color: string;
}> = ({ label, value, percent, color }) => (
  <div>
    <div className="mb-1.5 flex justify-between text-xs">
      <span className="font-bold text-slate-700">{label}</span>
      <span className="text-slate-500">
        {number(value, 1)} گرم · {number(percent)}٪
      </span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${Math.min(100, percent ?? 0)}%` }}
      />
    </div>
  </div>
);
