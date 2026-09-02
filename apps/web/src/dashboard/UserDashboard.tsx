import { useEffect, useMemo, useState } from 'react';
import type { FC, FormEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CalculatedNutritionTargets,
  DailyDiarySummary,
  DailyLifestyleSummary,
  FoodSummary,
  FoodPortionNutrition,
  FoodSubstitutionResult,
  GeneratedMealPlan,
  PaginatedResult,
  PublicUser,
  UserNutritionGoal,
  WeightTrend,
} from '@nutriai/types';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChefHat,
  CircleHelp,
  Droplets,
  Flame,
  HeartPulse,
  Menu,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
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

type OnboardingMeta = {
  primaryGoal: string;
  additionalGoals: string[];
  challenges: string[];
  barriers: string[];
  birthDate: string;
  idealWeight: string;
  dietType: 'normal' | 'vegetarian';
  sensitivities: string[];
  conditions: string[];
  method: 'diet' | 'calorie';
  dietPlan: string;
  difficulty: 'easy' | 'medium' | 'hard';
  startDay: 'today' | 'tomorrow' | 'after_tomorrow' | 'three_days';
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
const defaultMeta: OnboardingMeta = {
  primaryGoal: 'weight_loss',
  additionalGoals: ['health'],
  challenges: [],
  barriers: [],
  birthDate: '1375/01/01',
  idealWeight: '62',
  dietType: 'normal',
  sensitivities: [],
  conditions: [],
  method: 'diet',
  dietPlan: 'personalized',
  difficulty: 'medium',
  startDay: 'today',
};
const mealMeta = {
  breakfast: { fa: 'صبحانه', icon: '☀️', color: 'bg-amber-50 text-amber-700' },
  lunch: { fa: 'ناهار', icon: '🍲', color: 'bg-emerald-50 text-emerald-700' },
  dinner: { fa: 'شام', icon: '🌙', color: 'bg-indigo-50 text-indigo-700' },
  snack: { fa: 'میان‌وعده', icon: '🍎', color: 'bg-rose-50 text-rose-700' },
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
const primaryGoals = [
  ['weight_loss', 'کاهش وزن داشته باشم', 'کم‌کم سبک‌تر و پرانرژی‌تر شوم'],
  ['weight_gain', 'افزایش وزن داشته باشم', 'به وزن سالم و قوی‌تر برسم'],
  ['maintenance', 'وزنم را ثابت نگه دارم', 'همین تعادل خوب را حفظ کنم'],
  ['control', 'تغذیه‌ام را کنترل کنم', 'انتخاب‌های روزانه‌ام را بهتر کنم'],
  ['habit', 'سالم‌تر زندگی کنم', 'عادت‌های کوچک و ماندگار بسازم'],
] as const;
const additionalGoals = ['fit', 'health', 'confidence', 'fitness', 'doctor'] as const;
const additionalLabels: Record<(typeof additionalGoals)[number], string> = {
  fit: 'رسیدن به تناسب اندام',
  health: 'بهبود سلامتی',
  confidence: 'افزایش اعتماد به نفس',
  fitness: 'مدیریت تغذیه و ورزش',
  doctor: 'توصیه پزشک',
};
const challengeOptions = [
  'عادت به ریزه‌خواری',
  'پرخوری عصبی',
  'علاقه زیاد به غذا',
  'نداشتن انگیزه',
  'عدم آگاهی از روش‌های درست',
];
const barrierOptions = [
  'نداشتن زمان',
  'نداشتن حمایت',
  'کمبود اعتماد به نفس',
  'افزایش اشتها در اثر دارو',
  'نمی‌دانم از کجا شروع کنم',
];
const sensitivityOptions = [
  'شیر',
  'ماهی',
  'بادام',
  'بادام‌زمینی',
  'گردو',
  'سویا',
  'گلوتن',
  'حبوبات',
];
const conditionOptions = [
  'کم‌کاری تیروئید',
  'فشار خون بالا',
  'بیماری‌های قلبی',
  'دیابت',
  'کبد چرب',
  'ندارم',
];

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

const ChoiceCard: FC<{
  label: string;
  hint?: string;
  selected: boolean;
  multiple?: boolean;
  onClick: () => void;
  icon?: ReactNode;
}> = ({ label, hint, selected, multiple, onClick, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-[1.35rem] border px-4 py-4 text-right transition ${selected ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'}`}
  >
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center border ${selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white'} ${multiple ? 'rounded-md' : 'rounded-full'}`}
    >
      {selected && <Check className="h-4 w-4" />}
    </span>
    {icon && <span className="text-2xl">{icon}</span>}
    <span className="min-w-0 flex-1">
      <span className="block font-black text-slate-800">{label}</span>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </span>
  </button>
);
const WizardPage: FC<{ title: string; subtitle?: string; children: ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <div>
    <h3 className="text-center text-xl font-black leading-8 text-slate-900">{title}</h3>
    {subtitle && <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>}
    <div className="mt-5">{children}</div>
  </div>
);
const NumberField: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}> = ({ label, value, onChange, placeholder }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
    <input
      aria-label={label}
      type="number"
      min="1"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 text-center text-lg outline-none focus:border-emerald-400"
    />
  </label>
);
const SummaryRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0">
    <span className="text-slate-500">{label}</span>
    <strong className="text-slate-800">{value}</strong>
  </div>
);
const Gauge: FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className="rounded-2xl bg-slate-50 p-3 text-center">
    <div
      className="mx-auto grid h-16 w-16 place-items-center rounded-full"
      style={{ background: `conic-gradient(${color} 0 72%, #e5e7eb 72% 100%)` }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[10px] font-black text-slate-800">
        {value}
      </div>
    </div>
    <p className="mt-2 text-xs font-bold text-slate-500">{label}</p>
  </div>
);

const GoalWizard: FC<{
  initial?: GoalForm | null;
  onComplete: (form: GoalForm, meta: OnboardingMeta) => void;
  busy: boolean;
  error?: string;
}> = ({ initial, onComplete, busy, error }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<GoalForm>(initial ?? defaultGoal);
  const [meta, setMeta] = useState<OnboardingMeta>(defaultMeta);
  const update = <K extends keyof GoalForm>(key: K, value: GoalForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const toggle = (
    key: 'additionalGoals' | 'challenges' | 'barriers' | 'sensitivities' | 'conditions',
    value: string,
  ) =>
    setMeta((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  const isValid =
    step === 7 ? Number(form.heightCm) >= 50 : step === 8 ? Number(form.weightKg) >= 20 : true;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValid || busy) return;
    if (step < 22) setStep((value) => value + 1);
    else onComplete(form, meta);
  };
  const group = step <= 4 ? 0 : step <= 8 ? 1 : 2;
  const groupProgress = [
    Math.min(100, Math.round((step / 4) * 100)),
    Math.min(100, Math.round(((step - 4) / 4) * 100)),
    Math.min(100, Math.round(((step - 8) / 14) * 100)),
  ];
  return (
    <section className="mx-auto w-full max-w-xl rounded-[2rem] bg-[#f7f7f8] px-4 py-5 text-slate-900 shadow-sm sm:px-8 sm:py-8">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-emerald-600">
            {['تعیین هدف', 'تکمیل پروفایل', 'کالری‌شماری و رژیم غذایی'][group]}
          </p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">برنامهٔ شخصی تو</h2>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Target className="h-6 w-6" />
        </div>
      </div>
      <div className="mb-7 flex gap-2" aria-label="مراحل ثبت‌نام">
        {groupProgress.map((progress, index) => (
          <div key={index} className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${index <= group ? 'bg-emerald-400' : ''}`}
              style={{
                width: `${index === group ? Math.max(10, progress) : index < group ? 100 : 0}%`,
              }}
            />
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-5">
        {step === 1 && (
          <WizardPage title="مهم‌ترین هدفت از استفاده از کرفس چیه?">
            <div className="space-y-3">
              {primaryGoals.map(([value, label, hint]) => (
                <ChoiceCard
                  key={value}
                  label={label ?? ''}
                  hint={hint ?? ''}
                  selected={meta.primaryGoal === value}
                  onClick={() => {
                    setMeta((current) => ({ ...current, primaryGoal: value }));
                    if (value === 'weight_loss') update('dietGoal', 'weight_loss_mild');
                    if (value === 'weight_gain') update('dietGoal', 'muscle_gain_mild');
                    if (value === 'maintenance') update('dietGoal', 'maintenance');
                  }}
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 2 && (
          <WizardPage title="هدف دیگه‌ای هم داری؟" subtitle="می‌تونی چند تا انتخاب کنی">
            <div className="space-y-3">
              {additionalGoals.map((value) => (
                <ChoiceCard
                  key={value}
                  label={additionalLabels[value]}
                  multiple
                  selected={meta.additionalGoals.includes(value)}
                  onClick={() => toggle('additionalGoals', value)}
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 3 && (
          <WizardPage title="معمولاً چه چالش‌هایی باعث میشن از هدفت دور شی؟">
            <div className="space-y-3">
              {challengeOptions.map((value) => (
                <ChoiceCard
                  key={value}
                  label={value}
                  multiple
                  selected={meta.challenges.includes(value)}
                  onClick={() => toggle('challenges', value)}
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 4 && (
          <WizardPage title="چه چیزهایی مسیرت رو سخت می‌کنه؟">
            <div className="space-y-3">
              {barrierOptions.map((value) => (
                <ChoiceCard
                  key={value}
                  label={value}
                  multiple
                  selected={meta.barriers.includes(value)}
                  onClick={() => toggle('barriers', value)}
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 5 && (
          <WizardPage title="جنسیت رو مشخص کن">
            <div className="space-y-3">
              <ChoiceCard
                label="مرد"
                icon="👨🏻"
                selected={form.gender === 'male'}
                onClick={() => update('gender', 'male')}
              />
              <ChoiceCard
                label="زن"
                icon="👩🏻"
                selected={form.gender === 'female'}
                onClick={() => update('gender', 'female')}
              />
            </div>
          </WizardPage>
        )}
        {step === 6 && (
          <WizardPage title="تاریخ تولدت رو مشخص کن">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-600">تاریخ تولد</span>
              <input
                aria-label="تاریخ تولد"
                value={meta.birthDate}
                onChange={(event) =>
                  setMeta((current) => ({ ...current, birthDate: event.target.value }))
                }
                placeholder="مثلاً ۱۳۷۵/۰۱/۰۱"
                className="w-full rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 text-center text-lg outline-none focus:border-emerald-400"
              />
            </label>
          </WizardPage>
        )}
        {step === 7 && (
          <WizardPage title="قدت رو وارد کن">
            <NumberField
              label="قد (سانتی‌متر)"
              value={form.heightCm}
              onChange={(value) => update('heightCm', value)}
              placeholder="مثال: ۱۸۲"
            />
          </WizardPage>
        )}
        {step === 8 && (
          <WizardPage title="وزن فعلیت رو وارد کن">
            <NumberField
              label="وزن فعلی (کیلوگرم)"
              value={form.weightKg}
              onChange={(value) => update('weightKg', value)}
              placeholder="مثال: ۸۰"
            />
          </WizardPage>
        )}
        {step === 9 && (
          <WizardPage title="بر اساس اطلاعاتی که وارد کردی:">
            <div className="rounded-[1.5rem] bg-white p-5 text-center">
              <p className="text-sm leading-7 text-slate-600">
                شاخص توده بدنی (BMI) و محدودهٔ وزن مناسب تو محاسبه شد. این بازه برای رسیدن به تعادل
                و حفظ سلامتی پیشنهاد می‌شود.
              </p>
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs text-slate-500">BMI تقریبی</p>
                <strong className="mt-1 block text-3xl text-emerald-700">
                  {number(Number(form.weightKg) / (Number(form.heightCm) / 100) ** 2, 1)}
                </strong>
              </div>
            </div>
          </WizardPage>
        )}
        {step === 10 && (
          <WizardPage title="حالا وزن ایده‌آلت رو بر اساس این بازه انتخاب کن">
            <NumberField
              label="وزن ایده‌آل (کیلوگرم)"
              value={meta.idealWeight}
              onChange={(value) => setMeta((current) => ({ ...current, idealWeight: value }))}
              placeholder="وزن ایده‌آل"
            />
          </WizardPage>
        )}
        {step === 11 && (
          <WizardPage title="سطح فعالیتت در روز معمولاً چقدره؟">
            <div className="space-y-3">
              {[
                ['sedentary', 'خیلی کم', 'تقریباً بدون تحرک'],
                ['lightly_active', 'کم', 'فعالیت سبک خانه یا کار'],
                ['moderately_active', 'متوسط', 'ورزش ۳ تا ۵ روز در هفته'],
                ['very_active', 'زیاد', 'ورزش منظم و پرتحرک'],
              ].map(([value, label, hint]) => (
                <ChoiceCard
                  key={value}
                  label={label ?? ''}
                  hint={hint ?? ''}
                  selected={form.activityLevel === value}
                  onClick={() => update('activityLevel', value as GoalForm['activityLevel'])}
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 12 && (
          <WizardPage title="سبک غذاییت رو انتخاب کن">
            <div className="space-y-3">
              <ChoiceCard
                label="معمولی"
                hint="انواع گوشت و سبزیجات"
                icon="🍛"
                selected={meta.dietType === 'normal'}
                onClick={() => setMeta((current) => ({ ...current, dietType: 'normal' }))}
              />
              <ChoiceCard
                label="گیاه‌خواری"
                hint="بدون انواع گوشت"
                icon="🥗"
                selected={meta.dietType === 'vegetarian'}
                onClick={() => setMeta((current) => ({ ...current, dietType: 'vegetarian' }))}
              />
            </div>
          </WizardPage>
        )}
        {step === 13 && (
          <WizardPage title="حساسیت‌های غذایی" subtitle="اگر به هر کدوم حساسیت داری انتخاب کن">
            <div className="grid grid-cols-2 gap-3">
              {sensitivityOptions.map((value) => (
                <ChoiceCard
                  key={value}
                  label={value}
                  multiple
                  selected={meta.sensitivities.includes(value)}
                  onClick={() => toggle('sensitivities', value)}
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 14 && (
          <WizardPage title="اگر هر کدوم از این بیماری‌ها رو داری، انتخابشون کن">
            <div className="grid grid-cols-2 gap-3">
              {conditionOptions.map((value) => (
                <ChoiceCard
                  key={value}
                  label={value}
                  multiple
                  selected={meta.conditions.includes(value)}
                  onClick={() => toggle('conditions', value)}
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 15 && (
          <WizardPage title="روش برنامه رو انتخاب کن">
            <p className="text-center text-sm text-slate-600">
              برای رسیدن به وزن هدفت، یکی از این دو گزینه رو انتخاب کن
            </p>
            <div className="mt-4 grid grid-cols-2 rounded-full bg-slate-200 p-1">
              <button
                type="button"
                onClick={() => setMeta((current) => ({ ...current, method: 'diet' }))}
                className={`rounded-full px-3 py-3 text-sm font-black ${meta.method === 'diet' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
              >
                رژیم غذایی
              </button>
              <button
                type="button"
                onClick={() => setMeta((current) => ({ ...current, method: 'calorie' }))}
                className={`rounded-full px-3 py-3 text-sm font-black ${meta.method === 'calorie' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
              >
                کالری‌شماری
              </button>
            </div>
          </WizardPage>
        )}
        {step === 16 && (
          <WizardPage
            title={
              meta.method === 'diet' ? 'رژیم غذایی مناسب خودت رو انتخاب کن' : 'کالری‌شماری هوشمند'
            }
          >
            <div className="space-y-3">
              {[
                ['personalized', 'رژیم شخصی‌سازی شده', 'بر اساس مشخصات بدن و سلیقهٔ تو', '🍽️'],
                ['fasting', 'فستینگ و روزه‌داری', 'برنامه‌های ۱۶:۸ و منعطف', '⏱️'],
                ['easy', 'لوکرب آسان', 'کاهش کربوهیدرات بدون سخت‌گیری', '🥑'],
                ['mediterranean', 'مدیترانه‌ای', 'متعادل، رنگارنگ و سالم', '🥙'],
              ].map(([value, label, hint, icon]) => (
                <ChoiceCard
                  key={value}
                  label={label ?? ''}
                  hint={hint ?? ''}
                  icon={icon}
                  selected={meta.dietPlan === value}
                  onClick={() => setMeta((current) => ({ ...current, dietPlan: value ?? '' }))}
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 17 && (
          <WizardPage title="درجه سختی هدفت رو انتخاب کن">
            <div className="space-y-3">
              {[
                ['easy', 'آسان', 'کاهش ۲ کیلو در ماه'],
                ['medium', 'متوسط', 'کاهش ۳ کیلو در ماه'],
                ['hard', 'سخت', 'کاهش ۴ کیلو در ماه'],
              ].map(([value, label, hint]) => (
                <ChoiceCard
                  key={value}
                  label={label ?? ''}
                  hint={hint ?? ''}
                  selected={meta.difficulty === value}
                  onClick={() =>
                    setMeta((current) => ({
                      ...current,
                      difficulty: value as OnboardingMeta['difficulty'],
                    }))
                  }
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 18 && (
          <WizardPage title="روز شروع برنامه‌ت رو انتخاب کن">
            <div className="space-y-3">
              {[
                ['today', 'امروز'],
                ['tomorrow', 'فردا'],
                ['after_tomorrow', 'پس‌فردا'],
                ['three_days', 'سه روز دیگه'],
              ].map(([value, label]) => (
                <ChoiceCard
                  key={value}
                  label={label ?? ''}
                  selected={meta.startDay === value}
                  onClick={() =>
                    setMeta((current) => ({
                      ...current,
                      startDay: value as OnboardingMeta['startDay'],
                    }))
                  }
                />
              ))}
            </div>
          </WizardPage>
        )}
        {step === 19 && (
          <WizardPage title="خلاصهٔ انتخاب‌های تو">
            <div className="rounded-[1.5rem] bg-white p-4">
              <SummaryRow label="هدف" value={goalLabels[form.dietGoal].fa} />
              <SummaryRow
                label="روش برنامه"
                value={meta.method === 'diet' ? 'رژیم غذایی' : 'کالری‌شماری'}
              />
              <SummaryRow
                label="نوع رژیم"
                value={meta.dietType === 'normal' ? 'معمولی' : 'گیاه‌خواری'}
              />
              <SummaryRow
                label="درجه سختی"
                value={
                  meta.difficulty === 'easy' ? 'آسان' : meta.difficulty === 'hard' ? 'سخت' : 'متوسط'
                }
              />
            </div>
          </WizardPage>
        )}
        {step === 20 && (
          <WizardPage title="برنامه‌ت آماده‌ست">
            <div className="rounded-[1.6rem] bg-white p-5">
              <p className="text-center text-sm font-bold text-slate-600">پیشنهاد مصرف روزانه:</p>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Gauge label="کالری" value="۱۸۰۰" color="#f59e0b" />
                <Gauge label="پروتئین" value="۱۲۰ گرم" color="#ef6b76" />
                <Gauge label="کربوهیدرات" value="۲۳۰ گرم" color="#f7c948" />
                <Gauge label="چربی" value="۶۰ گرم" color="#f59e0b" />
              </div>
            </div>
          </WizardPage>
        )}
        {step === 21 && (
          <WizardPage title="برای رسیدن به هدفت این‌ها رو یادت باشه">
            <div className="space-y-3">
              {[
                ['هر روز غذاهات رو در کرفس ثبت کن و مقدار ماکروها رو رعایت کن', '🔥'],
                ['حتماً فعالیت بدنی روزانه داشته باش، حتی شده پیاده‌روی یا رقص', '👟'],
                ['روند پیشرفت رو بررسی کن و با انگیزه ادامه بده', '🎯'],
              ].map(([text, icon]) => (
                <div key={text} className="flex items-center gap-3 rounded-2xl bg-white p-4">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-sm font-bold leading-6 text-slate-700">{text}</span>
                </div>
              ))}
            </div>
          </WizardPage>
        )}
        {step === 22 && (
          <WizardPage title="همه‌چیز آماده است">
            <div className="rounded-[1.6rem] bg-emerald-600 p-6 text-center text-white">
              <Sparkles className="mx-auto h-10 w-10" />
              <p className="mt-3 text-lg font-black">می‌تونیم شروع کنیم؟</p>
              <p className="mt-2 text-sm leading-6 text-emerald-50">
                برنامهٔ امروزت همین حالا ساخته می‌شود و هر زمان خواستی می‌توانی وعده‌ها را عوض کنی.
              </p>
            </div>
          </WizardPage>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={step === 1 || busy}
            onClick={() => setStep((value) => value - 1)}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 disabled:invisible"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <button
            type="submit"
            disabled={!isValid || busy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500 text-base font-black text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600 disabled:bg-slate-300"
          >
            {busy
              ? 'در حال ساخت برنامه…'
              : step === 22
                ? 'برو بریم'
                : step === 21
                  ? 'متوجه شدم'
                  : 'بعدی'}
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
      </form>
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
  const [activeSection, setActiveSection] = useState<
    'dashboard' | 'progress' | 'workout' | 'cooking'
  >('dashboard');
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
  const lifestyle = useQuery({
    queryKey: ['lifestyle', 'summary', date],
    queryFn: () => apiRequest<DailyLifestyleSummary>(`/api/v1/lifestyle/summary?date=${date}`),
    enabled: Boolean(user),
    retry: false,
  });
  const trend = useQuery({
    queryKey: ['progress', 'weight', 'trend'],
    queryFn: () => apiRequest<WeightTrend>('/api/v1/progress/weight/trend?limit=30'),
    enabled: Boolean(user),
    retry: false,
  });
  const buildPlan = useMutation({
    mutationFn: async ({ form, meta }: { form: GoalForm; meta: OnboardingMeta }) => {
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
      return { form, meta, calculated, generated };
    },
    onSuccess: ({ form, meta, calculated, generated }) => {
      localStorage.setItem(`nutriai.goal.${user.id}`, JSON.stringify(form));
      localStorage.setItem(`nutriai.onboarding.${user.id}`, JSON.stringify(meta));
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
  const addWater = useMutation({
    mutationFn: () =>
      apiRequest('/api/v1/lifestyle/water', {
        method: 'POST',
        body: { amount_ml: 250, consumed_at: new Date().toISOString() },
      }),
    onSuccess: () => {
      setNotice('یک لیوان آب ثبت شد.');
      void queryClient.invalidateQueries({ queryKey: ['lifestyle', 'summary', date] });
    },
    onError: (error) => setNotice(errorMessage(error)),
  });
  const replaceMeal = useMutation({
    mutationFn: (input: { mealType: string; item: FoodPortionNutrition }) =>
      apiRequest<FoodSubstitutionResult>('/api/v1/substitutions', {
        method: 'POST',
        body: {
          food_id: input.item.foodId,
          grams: input.item.portionGrams,
          candidate_food_ids: (plan?.candidateFoodIds ?? []).filter(
            (id) => id !== input.item.foodId,
          ),
          limit: 1,
        },
      }),
    onSuccess: (result, input) => {
      const replacement = result.recommendations[0]?.food;
      if (!replacement) {
        setNotice('جایگزین مناسبی برای این وعده پیدا نشد.');
        return;
      }
      setPlan((current) =>
        current
          ? {
              ...current,
              days: current.days.map((day) => ({
                ...day,
                meals: day.meals.map((meal) =>
                  meal.mealType === input.mealType
                    ? {
                        ...meal,
                        nutrition: {
                          ...meal.nutrition,
                          totalPortionGrams: replacement.portionGrams,
                          totalEnergyKcal: replacement.energyKcal,
                          totalProteinGrams: replacement.proteinGrams,
                          totalCarbsGrams: replacement.carbsGrams,
                          totalFatGrams: replacement.fatGrams,
                          items: [replacement],
                        },
                      }
                    : meal,
                ),
              })),
            }
          : current,
      );
      setNotice(`${replacement.foodNameFa} جایگزین وعده شد.`);
    },
    onError: (error) => setNotice(errorMessage(error)),
  });
  const meals = plan?.days[0]?.meals ?? [];
  const consumed = diary.data?.nutrition;
  const calorieProgress =
    targets && consumed
      ? Math.min(100, Math.round((consumed.totalEnergyKcal / targets.targetCalories) * 100))
      : 0;
  const waterMl = lifestyle.data?.waterTotalMl ?? 0;
  const glasses = Math.min(8, Math.floor(waterMl / 250));
  useEffect(() => {
    if (!goal && persistedGoal.data?.goal) {
      const restored = fromPersistedGoal(persistedGoal.data.goal);
      setGoal(restored);
      setWizardOpen(false);
    }
  }, [goal, persistedGoal.data]);
  useEffect(() => {
    if (goal && foods.data && !targets && !buildPlan.isPending)
      buildPlan.mutate({ form: goal, meta: defaultMeta });
  }, [goal, foods.data, targets]);
  if (wizardOpen)
    return (
      <GoalWizard
        initial={goal}
        onComplete={(form, meta) => buildPlan.mutate({ form, meta })}
        busy={buildPlan.isPending}
        error={notice}
      />
    );
  const firstName = user.display_name.split(' ')[0];
  return (
    <div className="mx-auto w-full max-w-7xl pb-24">
      <section className="rounded-b-[2rem] bg-white px-4 pb-4 pt-2 sm:rounded-[2rem] sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('progress')}
              className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"
              aria-label="تقویم"
            >
              <CalendarDays className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('progress')}
              className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"
              aria-label="امتیاز"
            >
              <Flame className="h-5 w-5" />
            </button>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-black text-slate-900">داشبورد</h2>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {new Date().toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('cooking')}
            className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"
            aria-label="منو"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
        <div className="mt-4 rounded-[1.6rem] bg-[#f7f7f8] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">
                روش برنامه:{' '}
                <strong className="text-slate-800">
                  {localStorage.getItem(`nutriai.onboarding.${user.id}`)
                    ? 'رژیم غذایی'
                    : 'کالری‌شماری'}
                </strong>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                نوع رژیم:{' '}
                <strong className="text-slate-800">
                  {goal ? goalLabels[goal.dietGoal].fa : 'شخصی‌سازی شده'}
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="text-xs font-black text-emerald-600"
            >
              تغییر روش ‹
            </button>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-sm">
            <span className="text-slate-500">هدف: تثبیت وزن</span>
            <strong className="text-slate-800">روز ۱ از ۳۰</strong>
          </div>
        </div>
      </section>
      {notice && (
        <div
          role="status"
          className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 sm:mx-0"
        >
          <span>{notice}</span>
          <button type="button" aria-label="بستن پیام" onClick={() => setNotice('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {(activeSection === 'dashboard' || activeSection === 'progress') && (
        <section className="mt-4 space-y-4">
          <div className="rounded-[1.6rem] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">سلام {firstName} 👋</h3>
                <p className="mt-1 text-xs text-slate-500">
                  امروز یک قدم کوچک به هدف بزرگت نزدیک‌تر شو.
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-center">
                <p className="text-[10px] text-slate-500">هدف کالری</p>
                <strong className="text-lg text-amber-600">
                  {number(targets?.targetCalories)}
                </strong>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-amber-400"
                style={{ width: `${calorieProgress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {number(consumed?.totalEnergyKcal)} از {number(targets?.targetCalories)} کیلوکالری
              امروز
            </p>
          </div>
          <div className="rounded-[1.6rem] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-black text-slate-900">صبحانه</h3>
              <span className="text-xl">🥤</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-500">پیشنهاد: ۵۷۸–۵۳۳ کالری</span>
              <button
                type="button"
                onClick={() => setActiveSection('cooking')}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700"
              >
                › کالری
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFood(null)}
              className="mt-3 flex items-center gap-2 text-sm font-black text-emerald-600"
            >
              <Plus className="h-4 w-4" /> افزودن صبحانه
            </button>
          </div>
          {meals.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {meals.map((meal) => {
                const meta = mealMeta[meal.mealType];
                const item = meal.nutrition.items[0];
                return (
                  <article key={meal.mealType} className="rounded-[1.6rem] bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid h-10 w-10 place-items-center rounded-xl ${meta.color}`}
                        >
                          {meta.icon}
                        </span>
                        <div>
                          <h4 className="font-black text-slate-900">{meta.fa}</h4>
                          <p className="text-xs text-slate-500">
                            پیشنهاد: {number(meal.nutrition.totalEnergyKcal)} کالری
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={replaceMeal.isPending}
                        onClick={() =>
                          item && replaceMeal.mutate({ mealType: meal.mealType, item })
                        }
                        className="rounded-xl border border-slate-200 p-2 text-slate-500"
                        aria-label="تعویض غذا"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span>
                        {item?.foodNameFa ?? 'غذای پیشنهادی'} · {number(item?.portionGrams)} گرم
                      </span>
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
                        className="font-bold text-emerald-600"
                      >
                        ثبت وعده
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="rounded-[1.6rem] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">آب</h3>
                <p className="mt-1 text-xs text-slate-500">پیشنهاد: ۸ لیوان در روز</p>
              </div>
              <Droplets className="h-6 w-6 text-sky-500" />
            </div>
            <div className="mt-4 grid grid-cols-8 gap-1.5">
              {Array.from({ length: 8 }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => index >= glasses && addWater.mutate()}
                  className={`h-9 rounded-lg border text-sm transition ${index < glasses ? 'border-sky-200 bg-sky-100 text-sky-600' : 'border-slate-200 bg-white text-slate-400 hover:border-sky-300'}`}
                  aria-label={`لیوان آب ${index + 1}`}
                >
                  {index < glasses ? '✓' : '+'}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-xs">
              <span className="text-slate-400">آب نوشیده‌شده</span>
              <strong>{number(waterMl / 1000, 1)} لیتر</strong>
            </div>
          </div>
          {activeSection === 'dashboard' && <MacroCard targets={targets} />}
          {activeSection === 'progress' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <WeightTrendCard trend={trend.data} goal={goal} />
              <MacroCard targets={targets} />
            </div>
          )}
        </section>
      )}
      {(activeSection === 'dashboard' || activeSection === 'workout') && (
        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.6rem] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900">فعالیت</h3>
                <p className="mt-1 text-xs text-slate-500">کالری سوزانده‌شده: ۰</p>
              </div>
              <Activity className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
              هدف فعالیت هنوز ثبت نشده
            </p>
            <button
              type="button"
              onClick={() => setActiveSection('workout')}
              className="mt-3 flex items-center gap-2 text-sm font-black text-emerald-600"
            >
              <Plus className="h-4 w-4" /> افزودن فعالیت
            </button>
          </div>
          <div className="rounded-[1.6rem] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <CircleHelp className="h-5 w-5 text-amber-500" />
              <h3 className="font-black text-slate-900">توصیهٔ امروز</h3>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              حجم وعده‌های غذایی‌ات رو کم کن و بین وعده‌ها آب کافی بنوش.
            </p>
          </div>
        </section>
      )}
      {(activeSection === 'dashboard' || activeSection === 'cooking') && (
        <section className="mt-4 rounded-[1.6rem] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600">ثبت سریع</p>
              <h3 className="mt-1 font-black text-slate-900">غذایت را پیدا کن</h3>
            </div>
            <Search className="h-5 w-5 text-sky-500" />
          </div>
          <div className="relative mt-4">
            <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="مثلاً عدس، ماست، کباب…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-10 pl-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
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
        </section>
      )}
      <section className="mt-4 rounded-[1.6rem] bg-slate-900 p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/20">
            <Sparkles className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="font-black">همراه هم پیش می‌رویم</h3>
            <p className="mt-1 text-xs text-slate-300">وزن، آب و وعده‌هایت را هر روز ثبت کن.</p>
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
      <nav
        className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-xl items-end justify-around border-t border-slate-200 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+.65rem)] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur"
        aria-label="ناوبری اصلی"
      >
        {(
          [
            ['cooking', 'آشپزی', ChefHat],
            ['workout', 'ورزش', Activity],
            ['progress', 'پیشرفت', HeartPulse],
            ['dashboard', 'داشبورد', Menu],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`flex min-w-16 flex-col items-center gap-1 text-[11px] font-bold ${activeSection === key ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="absolute -top-6 left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-200"
          aria-label="افزودن"
        >
          <Plus className="h-7 w-7" />
        </button>
      </nav>
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
                aria-label="مقدار مصرف (گرم)"
                type="number"
                min="1"
                max="2000"
                value={portion}
                onChange={(event) => setPortion(event.target.value)}
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

const WeightTrendCard: FC<{ trend: WeightTrend | undefined; goal: GoalForm | null }> = ({
  trend,
  goal,
}) => {
  const entries = trend?.entries ?? [];
  const values = entries.length
    ? entries.map((entry) => entry.weightKg)
    : goal
      ? [
          Number(goal.weightKg),
          Math.max(20, Number(goal.weightKg) - 2),
          Math.max(20, Number(goal.weightKg) - 4),
        ]
      : [70, 68, 66];
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const points = values
    .map(
      (value, index) =>
        `${(index / Math.max(values.length - 1, 1)) * 100},${100 - ((value - min) / Math.max(max - min, 1)) * 82 - 8}`,
    )
    .join(' ');
  return (
    <article className="rounded-[1.6rem] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-900">پیشرفت وزن</h3>
          <p className="mt-1 text-xs text-slate-500">روند ثبت‌شدهٔ تو</p>
        </div>
        <Target className="h-5 w-5 text-emerald-500" />
      </div>
      <svg viewBox="0 0 100 100" className="mt-4 h-36 w-full overflow-visible">
        <polyline
          points={`0,100 ${points} 100,100`}
          fill="#34d399"
          fillOpacity=".12"
          stroke="none"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {values.map((value, index) => (
          <circle
            key={index}
            cx={(index / Math.max(values.length - 1, 1)) * 100}
            cy={100 - ((value - min) / Math.max(max - min, 1)) * 82 - 8}
            r="2.5"
            fill="#fff"
            stroke="#10b981"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-slate-500">
        <span>شروع {number(values[0], 1)} کیلو</span>
        <strong>امروز {number(values[values.length - 1], 1)} کیلو</strong>
      </div>
    </article>
  );
};
const MacroCard: FC<{ targets: CalculatedNutritionTargets | null }> = ({ targets }) => (
  <article className="rounded-[1.6rem] bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-black text-slate-900">تعادل روزانه</h3>
        <p className="mt-1 text-xs text-slate-500">تعادل پیشنهادی برنامه</p>
      </div>
      <Activity className="h-5 w-5 text-violet-500" />
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2">
      <Gauge
        label="پروتئین"
        value={`${number(targets?.macronutrients.proteinGrams)}g`}
        color="#8b5cf6"
      />
      <Gauge
        label="کربوهیدرات"
        value={`${number(targets?.macronutrients.carbsGrams)}g`}
        color="#f59e0b"
      />
      <Gauge label="چربی" value={`${number(targets?.macronutrients.fatGrams)}g`} color="#f43f5e" />
    </div>
  </article>
);
