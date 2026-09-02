import { useMemo, useState } from 'react';
import type { FC } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Droplets, Scale, Timer } from 'lucide-react';
import type { ApiResponse, DailyLifestyleSummary, WeightTrend } from '@nutriai/types';

const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:8787'
    : 'https://nutriai-api-production.rezhimvip.workers.dev');

async function readData<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error('API request failed');
  const body = (await response.json()) as ApiResponse<T>;
  return body.data;
}

export const DailyDashboard: FC = () => {
  const queryClient = useQueryClient();
  const date = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [waterMl, setWaterMl] = useState('250');
  const [weightKg, setWeightKg] = useState('');
  const lifestyle = useQuery({
    queryKey: ['lifestyle', 'summary', date],
    queryFn: async () =>
      readData<DailyLifestyleSummary>(
        await fetch(`${API_URL}/api/v1/lifestyle/summary?date=${date}`, {
          credentials: 'include',
        }),
      ),
    retry: false,
  });
  const trend = useQuery({
    queryKey: ['progress', 'weight', 'trend'],
    queryFn: async () =>
      readData<WeightTrend>(
        await fetch(`${API_URL}/api/v1/progress/weight/trend?limit=30`, {
          credentials: 'include',
        }),
      ),
    retry: false,
  });
  const addWater = useMutation({
    mutationFn: async () =>
      readData<{ entry: unknown }>(
        await fetch(`${API_URL}/api/v1/lifestyle/water`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            amount_ml: Number(waterMl),
            consumed_at: new Date().toISOString(),
          }),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lifestyle', 'summary', date] }),
  });
  const addWeight = useMutation({
    mutationFn: async () =>
      readData<{ entry: unknown }>(
        await fetch(`${API_URL}/api/v1/progress/weight`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            weight_kg: Number(weightKg),
            measured_at: new Date().toISOString(),
          }),
        }),
      ),
    onSuccess: () => {
      setWeightKg('');
      queryClient.invalidateQueries({ queryKey: ['progress', 'weight', 'trend'] });
    },
  });

  const summary = lifestyle.data;
  const weight = trend.data;
  const queryError = lifestyle.error ?? trend.error;
  const mutationError = addWater.error ?? addWeight.error;
  return (
    <>
      {(queryError || mutationError) && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {queryError instanceof Error
            ? queryError.message
            : mutationError instanceof Error
              ? mutationError.message
              : 'خطا در دریافت یا ثبت اطلاعات روزانه'}
        </p>
      )}
      <section aria-label="Daily tracking" className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <article className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-sky-700 font-semibold">
            <Droplets className="w-5 h-5" /> آب امروز
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-4">{summary?.waterTotalMl ?? 0} ml</p>
          <form
            className="flex gap-2 mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              addWater.mutate();
            }}
          >
            <input
              aria-label="Water amount in millilitres"
              type="number"
              min="1"
              max="10000"
              value={waterMl}
              onChange={(event) => setWaterMl(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={addWater.isPending || !waterMl || Number(waterMl) <= 0}
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              ثبت
            </button>
          </form>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-violet-700 font-semibold">
            <Scale className="w-5 h-5" /> روند وزن
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-4">
            {weight?.latestWeightKg === null || weight?.latestWeightKg === undefined
              ? '—'
              : `${weight.latestWeightKg} kg`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            تغییر:{' '}
            {weight?.changeKg === null || weight?.changeKg === undefined
              ? '—'
              : `${weight.changeKg} kg`}
          </p>
          <form
            className="flex gap-2 mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              addWeight.mutate();
            }}
          >
            <input
              aria-label="Weight in kilograms"
              type="number"
              min="20"
              max="350"
              step="0.1"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={addWeight.isPending || !weightKg}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              ثبت
            </button>
          </form>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 text-amber-700 font-semibold">
            <Timer className="w-5 h-5" /> روزه فعال
          </div>
          <p className="text-3xl font-bold text-slate-900 mt-4">
            {summary?.activeFast ? `${summary.activeFast.goalHours} ساعت` : 'ندارد'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {summary?.activeFast
              ? `شروع ${new Date(summary.activeFast.startedAt).toLocaleTimeString()}`
              : 'برای شروع از API روزه استفاده کنید'}
          </p>
        </article>
      </section>
    </>
  );
};
