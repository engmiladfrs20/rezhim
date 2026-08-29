import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UtensilsCrossed,
  Plus,
  Eye,
  Edit2,
  Archive,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type {
  FoodSummary,
  FoodDetail,
  FoodCategoryDetail,
  NutrientDefinition,
  ApiResponse,
  PaginatedResult,
} from '@nutriai/types';
import type { CreateFoodDto } from '@nutriai/schemas';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

interface FoodDetailModalProps {
  foodId: string;
  onClose: () => void;
}

export const FoodDetailModal: FC<FoodDetailModalProps> = ({ foodId, onClose }) => {
  const { data, isLoading, error } = useQuery<ApiResponse<{ food: FoodDetail }>>({
    queryKey: ['admin-food-detail', foodId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/admin/foods/${foodId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load food details');
      return res.json() as Promise<ApiResponse<{ food: FoodDetail }>>;
    },
  });

  const food = data?.data?.food;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-indigo-400" />
            {food ? food.name : 'Food Details'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="text-center py-6 text-slate-400">Loading food details...</div>
        )}
        {error && (
          <div className="text-center py-6 text-red-400">
            {error instanceof Error ? error.message : 'Error loading food details'}
          </div>
        )}

        {food && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl">
              <div>
                <span className="text-slate-400 text-xs block">ID</span>
                <span className="font-mono text-xs text-slate-200">{food.id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Status</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${
                    food.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : food.status === 'draft'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {food.status}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Type</span>
                <span className="text-slate-200 capitalize">{food.foodType}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Barcode</span>
                <span className="font-mono text-slate-200">{food.barcode || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Category</span>
                <span className="text-slate-200">{food.category?.name || 'Uncategorized'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-xs block">Source</span>
                <span className="text-slate-200">{food.source?.name || 'Manual'}</span>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-200 mb-2">Translations</h4>
              <div className="space-y-1.5">
                {food.translations.map((t) => (
                  <div key={t.id} className="bg-slate-900 p-2.5 rounded-lg flex justify-between">
                    <span className="text-slate-400 uppercase text-xs font-mono">{t.locale}</span>
                    <span className="text-slate-200 font-medium">{t.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-200 mb-2">Nutrients (per 100g)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {food.nutrients.map((n) => (
                  <div key={n.nutrientId} className="bg-slate-900 p-2 rounded-lg text-xs">
                    <span className="text-slate-400 block">{n.name}</span>
                    <span className="font-bold text-slate-100">
                      {n.amountPer100g} {n.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {food.servings.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-200 mb-2">Serving Sizes</h4>
                <div className="space-y-1.5">
                  {food.servings.map((s) => (
                    <div
                      key={s.id}
                      className="bg-slate-900 p-2.5 rounded-lg flex justify-between text-xs"
                    >
                      <span className="text-slate-200">
                        {s.nameFa} / {s.nameEn} {s.householdUnit ? `(${s.householdUnit})` : ''}
                      </span>
                      <span className="font-mono text-indigo-300 font-bold">{s.weightG}g</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface FoodFormModalProps {
  foodToEdit?: FoodDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const FoodFormModal: FC<FoodFormModalProps> = ({ foodToEdit, onClose, onSuccess }) => {
  const isEditing = Boolean(foodToEdit);
  const [nameFa, setNameFa] = useState(
    foodToEdit?.translations.find((t) => t.locale === 'fa')?.name || '',
  );
  const [nameEn, setNameEn] = useState(
    foodToEdit?.translations.find((t) => t.locale === 'en')?.name || '',
  );
  const [categoryId, setCategoryId] = useState(foodToEdit?.categoryId || '');
  const [foodType, setFoodType] = useState<'generic' | 'branded'>(
    foodToEdit?.foodType || 'generic',
  );
  const [brandName, setBrandName] = useState(foodToEdit?.brandName || '');
  const [barcode, setBarcode] = useState(foodToEdit?.barcode || '');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>(
    foodToEdit?.status || 'active',
  );

  // Nutrients state (Energy, Protein, Carbs, Fat, Fiber)
  const getNutVal = (code: string) => {
    const found = foodToEdit?.nutrients.find((n) => n.code === code);
    return found ? String(found.amountPer100g) : '';
  };
  const [energyKcal, setEnergyKcal] = useState(getNutVal('energy'));
  const [proteinG, setProteinG] = useState(getNutVal('protein'));
  const [carbsG, setCarbsG] = useState(getNutVal('carbohydrate'));
  const [fatG, setFatG] = useState(getNutVal('fat_total'));
  const [fiberG, setFiberG] = useState(getNutVal('fiber'));

  // Serving state
  const [servingNameFa, setServingNameFa] = useState(foodToEdit?.servings[0]?.nameFa || '');
  const [servingNameEn, setServingNameEn] = useState(foodToEdit?.servings[0]?.nameEn || '');
  const [servingWeightG, setServingWeightG] = useState(
    foodToEdit?.servings[0] ? String(foodToEdit.servings[0].weightG) : '',
  );

  const [formError, setFormError] = useState('');

  // Fetch categories & nutrient definitions
  const { data: catData } = useQuery<ApiResponse<{ categories: FoodCategoryDetail[] }>>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/admin/foods/categories`, {
        credentials: 'include',
      });
      return res.json() as Promise<ApiResponse<{ categories: FoodCategoryDetail[] }>>;
    },
  });

  const { data: nutData } = useQuery<ApiResponse<{ nutrients: NutrientDefinition[] }>>({
    queryKey: ['nutrients-def'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/nutrients`, { credentials: 'include' });
      return res.json() as Promise<ApiResponse<{ nutrients: NutrientDefinition[] }>>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: CreateFoodDto) => {
      setFormError('');
      const url = isEditing
        ? `${API_URL}/api/v1/admin/foods/${foodToEdit!.id}`
        : `${API_URL}/api/v1/admin/foods`;
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message || 'Failed to save food');
      }

      return res.json();
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!nameFa.trim() && !nameEn.trim()) {
      setFormError('At least one translation (Persian or English) is required');
      return;
    }

    const translations = [];
    if (nameFa.trim()) translations.push({ locale: 'fa' as const, name: nameFa.trim() });
    if (nameEn.trim()) translations.push({ locale: 'en' as const, name: nameEn.trim() });

    const nutrients = [];
    const nutrientsList = nutData?.data?.nutrients || [];
    const energyDef = nutrientsList.find((n) => n.code === 'energy');
    const proteinDef = nutrientsList.find((n) => n.code === 'protein');
    const carbsDef = nutrientsList.find((n) => n.code === 'carbohydrate');
    const fatDef = nutrientsList.find((n) => n.code === 'fat_total');
    const fiberDef = nutrientsList.find((n) => n.code === 'fiber');

    if (energyDef && energyKcal)
      nutrients.push({ nutrient_id: energyDef.id, amount_per_100g: Number(energyKcal) });
    if (proteinDef && proteinG)
      nutrients.push({ nutrient_id: proteinDef.id, amount_per_100g: Number(proteinG) });
    if (carbsDef && carbsG)
      nutrients.push({ nutrient_id: carbsDef.id, amount_per_100g: Number(carbsG) });
    if (fatDef && fatG) nutrients.push({ nutrient_id: fatDef.id, amount_per_100g: Number(fatG) });
    if (fiberDef && fiberG)
      nutrients.push({ nutrient_id: fiberDef.id, amount_per_100g: Number(fiberG) });

    const servings = [];
    if (servingNameFa && servingNameEn && servingWeightG) {
      servings.push({
        name_fa: servingNameFa.trim(),
        name_en: servingNameEn.trim(),
        weight_g: Number(servingWeightG),
      });
    }

    const payload: CreateFoodDto = {
      category_id: categoryId || undefined,
      food_type: foodType,
      brand_name: brandName.trim() || undefined,
      barcode: barcode.trim() || undefined,
      status,
      translations,
      aliases: [],
      nutrients,
      servings,
    };

    saveMutation.mutate(payload);
  };

  const categories = catData?.data?.categories || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-indigo-400" />
            {isEditing ? 'Edit Food' : 'Add New Food'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Persian Name (نام فارسی) *
              </label>
              <input
                type="text"
                value={nameFa}
                onChange={(e) => setNameFa(e.target.value)}
                placeholder="مثلاً: سیب تازه"
                dir="rtl"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">English Name *</label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Fresh Apple"
                dir="ltr"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select
                value={foodType}
                onChange={(e) => setFoodType(e.target.value as 'generic' | 'branded')}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="generic">Generic (عمومی)</option>
                <option value="branded">Branded (تجاری / برند)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'active' | 'archived')}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Brand Name (if branded)</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Pegah, Kalleh"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Barcode</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 6260123456789"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-3">Macronutrients (per 100g)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Calories (kcal)</label>
                <input
                  aria-label="Calories (kcal)"
                  type="number"
                  step="0.1"
                  min="0"
                  value={energyKcal}
                  onChange={(e) => setEnergyKcal(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Protein (g)</label>
                <input
                  aria-label="Protein (g)"
                  type="number"
                  step="0.1"
                  min="0"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Carbs (g)</label>
                <input
                  aria-label="Carbs (g)"
                  type="number"
                  step="0.1"
                  min="0"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fat (g)</label>
                <input
                  aria-label="Fat (g)"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fiber (g)</label>
                <input
                  aria-label="Fiber (g)"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fiberG}
                  onChange={(e) => setFiberG(e.target.value)}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-sm font-semibold text-slate-200 mb-3">Serving Size (Optional)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Serving Name (FA)</label>
                <input
                  type="text"
                  value={servingNameFa}
                  onChange={(e) => setServingNameFa(e.target.value)}
                  placeholder="مثلاً: یک لیوان"
                  dir="rtl"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Serving Name (EN)</label>
                <input
                  type="text"
                  value={servingNameEn}
                  onChange={(e) => setServingNameEn(e.target.value)}
                  placeholder="e.g. 1 Cup"
                  dir="ltr"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Weight in Grams (g)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={servingWeightG}
                  onChange={(e) => setServingWeightG(e.target.value)}
                  placeholder="e.g. 240"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Food'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FoodCatalogManager: FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>(null);
  const [foodToEdit, setFoodToEdit] = useState<FoodDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Categories query for filter
  const { data: catData } = useQuery<ApiResponse<{ categories: FoodCategoryDetail[] }>>({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/admin/foods/categories`, {
        credentials: 'include',
      });
      return res.json() as Promise<ApiResponse<{ categories: FoodCategoryDetail[] }>>;
    },
  });

  // Food list query
  const { data, isLoading, error } = useQuery<ApiResponse<PaginatedResult<FoodSummary>>>({
    queryKey: ['admin-foods', statusFilter, categoryFilter, cursor],
    queryFn: async () => {
      let url = `${API_URL}/api/v1/admin/foods?limit=10&status=${statusFilter}`;
      if (categoryFilter) url += `&category_id=${categoryFilter}`;
      if (cursor) url += `&cursor=${cursor}`;

      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch food catalog');
      return res.json() as Promise<ApiResponse<PaginatedResult<FoodSummary>>>;
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      setErrorMsg('');
      const res = await fetch(`${API_URL}/api/v1/admin/foods/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message || 'Failed to archive food');
      }
      return res.json();
    },
    onSuccess: () => {
      setFeedbackMsg('Food item successfully archived');
      queryClient.invalidateQueries({ queryKey: ['admin-foods'] });
      setTimeout(() => setFeedbackMsg(''), 4000);
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Archive failed');
    },
  });

  const handleEditClick = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/foods/${id}`, { credentials: 'include' });
      if (res.ok) {
        const payload = (await res.json()) as ApiResponse<{ food: FoodDetail }>;
        setFoodToEdit(payload.data.food);
      }
    } catch {
      setErrorMsg('Failed to load food for editing');
    }
  };

  const handleArchiveClick = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to archive "${name}"?`)) {
      archiveMutation.mutate(id);
    }
  };

  const foods = data?.data?.items || [];
  const nextCursor = data?.data?.nextCursor;
  const categories = catData?.data?.categories || [];

  return (
    <div className="w-full bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col gap-6">
      {feedbackMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-4 rounded-lg border border-slate-800">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <UtensilsCrossed className="w-5 h-5 text-indigo-400" /> Food Catalog Management
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter by Category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCursor(null);
              setHistory([]);
            }}
            className="bg-slate-800 border-slate-700 text-sm rounded-lg p-2 text-slate-200"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCursor(null);
              setHistory([]);
            }}
            className="bg-slate-800 border-slate-700 text-sm rounded-lg p-2 text-slate-200"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>

          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 text-white"
          >
            <Plus className="w-4 h-4" /> Add Food
          </button>
        </div>
      </div>

      {isLoading && <div className="p-8 text-center text-slate-400">Loading food catalog...</div>}
      {error && <div className="p-8 text-center text-red-500">Error loading food catalog.</div>}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Calories</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {foods.map((f) => (
                <tr key={f.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-100 block">{f.name}</span>
                    {f.brandName && (
                      <span className="text-xs text-slate-400 block">{f.brandName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-300">{f.foodType}</td>
                  <td className="px-4 py-3 text-slate-300">{f.categoryName || '—'}</td>
                  <td className="px-4 py-3 font-mono text-slate-200">
                    {f.energyKcal !== null ? `${f.energyKcal} kcal` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        f.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : f.status === 'draft'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {f.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedFoodId(f.id)}
                      title="View Details"
                      aria-label={`View details for ${f.name}`}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditClick(f.id)}
                      title="Edit Food"
                      aria-label={`Edit ${f.name}`}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-indigo-300"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {f.status !== 'archived' && (
                      <button
                        onClick={() => handleArchiveClick(f.id, f.name)}
                        title="Archive Food"
                        aria-label={`Archive ${f.name}`}
                        className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-red-400"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {foods.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No foods found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between items-center text-sm border-t border-slate-700 pt-4">
        <button
          disabled={history.length === 0}
          onClick={() => {
            const newHistory = [...history];
            const prev = newHistory.pop();
            setHistory(newHistory);
            setCursor(prev || null);
          }}
          className="px-4 py-2 bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-600 transition-colors"
        >
          Previous
        </button>
        <span className="text-slate-400">Page {history.length + 1}</span>
        <button
          disabled={!nextCursor}
          onClick={() => {
            if (nextCursor) {
              setHistory([...history, cursor || '']);
              setCursor(nextCursor);
            }
          }}
          className="px-4 py-2 bg-slate-700 rounded disabled:opacity-50 hover:bg-slate-600 transition-colors"
        >
          Next
        </button>
      </div>

      {selectedFoodId && (
        <FoodDetailModal foodId={selectedFoodId} onClose={() => setSelectedFoodId(null)} />
      )}

      {(isCreating || foodToEdit) && (
        <FoodFormModal
          foodToEdit={foodToEdit}
          onClose={() => {
            setIsCreating(false);
            setFoodToEdit(null);
          }}
          onSuccess={() => {
            setIsCreating(false);
            setFoodToEdit(null);
            setFeedbackMsg(isEditingMode(foodToEdit) ? 'Food updated' : 'Food created');
            queryClient.invalidateQueries({ queryKey: ['admin-foods'] });
            setTimeout(() => setFeedbackMsg(''), 4000);
          }}
        />
      )}
    </div>
  );
};

function isEditingMode(food: FoodDetail | null): boolean {
  return Boolean(food);
}
