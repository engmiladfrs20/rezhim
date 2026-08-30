import type { FoodDatasetItem, FoodSourceManifest } from '@nutriai/types';

export const openIranianSourceManifest: FoodSourceManifest = {
  id: 'src_open_iranian_foods',
  name: 'NutriAI Open Iranian Food Catalog Baseline',
  code: 'open_iranian_foods',
  publisher: 'NutriAI Persia Project',
  url: 'https://github.com/engmiladfrs20/rezhim/tree/main/data/sources/open-iranian-foods',
  version: '1.0.0',
  acquisitionDate: '2026-08-30T00:00:00.000Z',
  license: 'CC0-1.0',
  redistributionAllowed: true,
  sha256Checksum: 'babc92f91d78a73958114228b4b990fd6982a405f435ea3844655e454f2f53f6',
  language: 'fa, en',
  description:
    'Open baseline dataset of Iranian traditional foods, breads, and dishes curated from open laboratory food composition references and verified portion weights.',
};

export const fctManifest: FoodSourceManifest = {
  id: 'src_iranian_fct_adapter',
  name: 'Iranian Food Composition Tables (Adapter)',
  code: 'iranian_fct_adapter',
  publisher:
    'National Nutrition and Food Technology Research Institute (NNFTRI), Shahid Beheshti University of Medical Sciences',
  url: 'https://nnftri.sbmu.ac.ir/',
  version: '2024.1',
  acquisitionDate: '2026-08-30T00:00:00.000Z',
  license: 'Proprietary - Official Publication (No Redistribution)',
  redistributionAllowed: false,
  sha256Checksum: '2e28f6dfba2052714d84aea3f8fafe63c9f5d70b6f8e3ca9fa1bfe86c297504d',
  language: 'fa, en',
  description:
    'National Nutrition and Food Technology Research Institute (NNFTRI) Food Composition Tables adapter schema. Note: Proprietary raw database is NOT committed to git repository; template format is provided for licensed local ingestion.',
};

export const fctTemplateFoods: FoodDatasetItem[] = [
  {
    external_id: 'nnftri_template_001',
    slug: 'nnftri-sample-item',
    category_id: 'cat_grains',
    category_slug: 'grains-cereals',
    food_type: 'generic',
    status: 'draft',
    source_id: 'src_iranian_fct_adapter',
    translations: [
      {
        locale: 'fa',
        name: 'نمونه ماده غذایی جدول ترکیبات ایرانی',
        description: 'الگوی ورود اطلاعات برای جدول ترکیبات مواد غذایی انستیتو تغذیه ایران',
      },
      {
        locale: 'en',
        name: 'NNFTRI Sample Food Composition Item',
        description:
          'Ingestion template for Iranian National Food Composition Table records for local researchers',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'نمونه جدول ترکیبات' },
      { locale: 'en', alias: 'NNFTRI Sample' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 250 },
      { nutrient_id: 'nut_protein', amount_per_100g: 8.5 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 48 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 2 },
    ],
    servings: [
      {
        name_fa: '۱ سهم استاندارد (۱۰۰ گرم)',
        name_en: '1 Standard Serving (100g)',
        weight_g: 100,
        household_unit: 'سهم',
      },
    ],
  },
];

export const openIranianFoods: FoodDatasetItem[] = [
  {
    external_id: 'item_sangak',
    slug: 'sangak-bread',
    category_id: 'cat_grains',
    category_slug: 'grains-cereals',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'نان سنگک سنتی',
        description: 'نان سبوس‌دار سنتی ایرانی پخته‌شده روی ریگ داغ در تنور',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Sangak Flatbread',
        description: 'Whole wheat sourdough flatbread traditionally baked on small river pebbles',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'سنگک' },
      { locale: 'fa', alias: 'نان سنگک کنجدی' },
      { locale: 'en', alias: 'Sangak Bread' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 259 },
      { nutrient_id: 'nut_protein', amount_per_100g: 9.2 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 50.1 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 1.8 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 4.8 },
      { nutrient_id: 'nut_sugar', amount_per_100g: 0.8 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 480 },
      { nutrient_id: 'nut_iron', amount_per_100g: 2.1 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 35 },
    ],
    servings: [
      {
        name_fa: '۱ کف دست بدون انگشتان',
        name_en: '1 Handful (Palm size)',
        weight_g: 30,
        household_unit: 'کف دست',
      },
      {
        name_fa: '۱ قرص نان کامل',
        name_en: '1 Whole Loaf',
        weight_g: 430,
        household_unit: 'قرص',
      },
    ],
  },
  {
    external_id: 'item_barbari',
    slug: 'barbari-bread',
    category_id: 'cat_grains',
    category_slug: 'grains-cereals',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'نان بربری سنتی',
        description: 'نان حجیم سنتی با رومال آرد و آب و تزئین کنجد',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Barbari Flatbread',
        description: 'Thick yeast-leavened flatbread with a glazed golden crust',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'بربری' },
      { locale: 'fa', alias: 'نان بربری کنجدی' },
      { locale: 'en', alias: 'Barbari Bread' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 274 },
      { nutrient_id: 'nut_protein', amount_per_100g: 8.8 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 56.4 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 1.4 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 2.8 },
      { nutrient_id: 'nut_sugar', amount_per_100g: 1.2 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 510 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 28 },
    ],
    servings: [
      {
        name_fa: '۱ کف دست',
        name_en: '1 Handful (Palm size)',
        weight_g: 30,
        household_unit: 'کف دست',
      },
      {
        name_fa: '۱ قرص نان کامل',
        name_en: '1 Whole Loaf',
        weight_g: 400,
        household_unit: 'قرص',
      },
    ],
  },
  {
    external_id: 'item_taftoon',
    slug: 'taftoon-bread',
    category_id: 'cat_grains',
    category_slug: 'grains-cereals',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'نان تافتون سنتی',
        description: 'نان تنوری نازک و گرد سنتی ایرانی',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Taftoon Flatbread',
        description: 'Round clay-oven baked flatbread',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'تافتون' },
      { locale: 'en', alias: 'Taftoon Bread' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 283 },
      { nutrient_id: 'nut_protein', amount_per_100g: 8.9 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 58.7 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 1.5 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 2.4 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 460 },
    ],
    servings: [
      {
        name_fa: '۱ کف دست',
        name_en: '1 Handful (Palm size)',
        weight_g: 25,
        household_unit: 'کف دست',
      },
      {
        name_fa: '۱ قرص نان کامل',
        name_en: '1 Whole Loaf',
        weight_g: 220,
        household_unit: 'قرص',
      },
    ],
  },
  {
    external_id: 'item_lavash',
    slug: 'lavash-bread',
    category_id: 'cat_grains',
    category_slug: 'grains-cereals',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'نان لواش سنتی',
        description: 'نان بسیار نازک تنوری سنتی ایرانی',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Lavash Flatbread',
        description: 'Very thin unleavened clay oven flatbread',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'لواش' },
      { locale: 'en', alias: 'Lavash Bread' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 290 },
      { nutrient_id: 'nut_protein', amount_per_100g: 9.1 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 61.2 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 1.1 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 2.1 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 520 },
    ],
    servings: [
      {
        name_fa: '۱ کف دست',
        name_en: '1 Handful (Palm size)',
        weight_g: 20,
        household_unit: 'کف دست',
      },
      {
        name_fa: '۱ قرص نان کامل',
        name_en: '1 Whole Sheet',
        weight_g: 100,
        household_unit: 'قرص',
      },
    ],
  },
  {
    external_id: 'item_kateh_rice',
    slug: 'kateh-cooked-rice',
    category_id: 'cat_grains',
    category_slug: 'grains-cereals',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'برنج کته سنتی ایرانی (پخته با روغن و نمک کم)',
        description: 'برنج ایرانی دم‌کشیده به روش کته سنتی شمالی',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Kateh Rice (Cooked, Light Oil)',
        description: 'Traditional northern Iranian absorbed rice preparation',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'کته' },
      { locale: 'fa', alias: 'برنج کته' },
      { locale: 'en', alias: 'Kateh Rice' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 145 },
      { nutrient_id: 'nut_protein', amount_per_100g: 2.7 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 28.5 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 2.2 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 0.6 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 150 },
    ],
    servings: [
      {
        name_fa: '۱ کفگیر برنج',
        name_en: '1 Persian Rice Spatula (Kafgir)',
        weight_g: 80,
        household_unit: 'کفگیر',
      },
      {
        name_fa: '۱ لیوان پخته',
        name_en: '1 Cup Cooked',
        weight_g: 160,
        household_unit: 'لیوان',
      },
    ],
  },
  {
    external_id: 'item_chelow_rice',
    slug: 'chelow-cooked-rice',
    category_id: 'cat_grains',
    category_slug: 'grains-cereals',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'چلو ایرانی آبکش دم‌کشیده (پخته ساده با کره کم)',
        description: 'برنج سفید دانه بلند آبکش و دم‌کشیده سنتی مجلسی ایرانی',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Chelow Rice (Steamed & Drained)',
        description: 'Long-grain fragrant Persian steamed rice, parboiled and gently steamed',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'چلو' },
      { locale: 'fa', alias: 'برنج سفید آبکش' },
      { locale: 'en', alias: 'Chelow Rice' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 152 },
      { nutrient_id: 'nut_protein', amount_per_100g: 2.6 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 30.1 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 2.5 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 0.4 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 180 },
    ],
    servings: [
      {
        name_fa: '۱ کفگیر برنج',
        name_en: '1 Persian Rice Spatula (Kafgir)',
        weight_g: 85,
        household_unit: 'کفگیر',
      },
      {
        name_fa: '۱ دیس تک‌نفره',
        name_en: '1 Individual Portion',
        weight_g: 250,
        household_unit: 'پرس',
      },
    ],
  },
  {
    external_id: 'item_barley_bread',
    slug: 'barley-bread-persian',
    category_id: 'cat_grains',
    category_slug: 'grains-cereals',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'نان جو سنتی ایرانی',
        description: 'نان غلات کامل پخته‌شده با آرد جو و سبوس',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Barley Bread',
        description: 'High-fiber whole barley flatbread',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'نان جو' },
      { locale: 'en', alias: 'Barley Bread' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 245 },
      { nutrient_id: 'nut_protein', amount_per_100g: 9.8 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 46.5 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 2.1 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 7.6 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 390 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 45 },
    ],
    servings: [
      {
        name_fa: '۱ کف دست',
        name_en: '1 Handful (Palm size)',
        weight_g: 30,
        household_unit: 'کف دست',
      },
    ],
  },
  {
    external_id: 'item_yogurt_full_fat',
    slug: 'persian-yogurt-full-fat',
    category_id: 'cat_dairy',
    category_slug: 'dairy-eggs',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'ماست سنتی پرچرب ایرانی',
        description: 'ماست تخمیری کامل تهیه شده از شیر گاو سنتی',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Full-Fat Yogurt',
        description: 'Creamy cultured whole milk yogurt',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'ماست پرچرب' },
      { locale: 'fa', alias: 'ماست سنتی' },
      { locale: 'en', alias: 'Persian Yogurt' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 68 },
      { nutrient_id: 'nut_protein', amount_per_100g: 3.5 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 4.7 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 3.8 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 125 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 50 },
    ],
    servings: [
      {
        name_fa: '۱ لیوان',
        name_en: '1 Cup',
        weight_g: 240,
        household_unit: 'لیوان',
      },
      {
        name_fa: '۱ قاشق غذاخوری سرپر',
        name_en: '1 Heaping Tablespoon',
        weight_g: 30,
        household_unit: 'قاشق غذاخوری',
      },
    ],
  },
  {
    external_id: 'item_yogurt_strained_labneh',
    slug: 'persian-strained-yogurt-labneh',
    category_id: 'cat_dairy',
    category_slug: 'dairy-eggs',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'ماست چکیده سنتی ایرانی',
        description: 'ماست آب‌گیری شده غلیظ سنتی',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Strained Yogurt (Labneh / Maste Chekideh)',
        description: 'Thick creamy strained yogurt',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'ماست چکیده' },
      { locale: 'fa', alias: 'ماست کیسه‌ای' },
      { locale: 'en', alias: 'Strained Yogurt' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 132 },
      { nutrient_id: 'nut_protein', amount_per_100g: 7.8 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 5.2 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 8.9 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 210 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 85 },
    ],
    servings: [
      {
        name_fa: '۱ قاشق غذاخوری سرپر',
        name_en: '1 Heaping Tablespoon',
        weight_g: 35,
        household_unit: 'قاشق غذاخوری',
      },
      {
        name_fa: '۱ پیاله کوچک',
        name_en: '1 Small Bowl',
        weight_g: 120,
        household_unit: 'پیاله',
      },
    ],
  },
  {
    external_id: 'item_kashk_liquid',
    slug: 'liquid-kashk-whey',
    category_id: 'cat_dairy',
    category_slug: 'dairy-eggs',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'کشک مایع پاستوریزه سنتی',
        description: 'فراورده تخمیری سنتی شیر غنی از پروتئین و کلسیم',
      },
      {
        locale: 'en',
        name: 'Traditional Liquid Kashk (Persian Fermented Whey)',
        description: 'Cultured salted liquid whey paste used in Iranian cooking',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'کشک' },
      { locale: 'fa', alias: 'کشک مایع' },
      { locale: 'en', alias: 'Liquid Kashk' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 110 },
      { nutrient_id: 'nut_protein', amount_per_100g: 14.5 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 6.2 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 3.1 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 430 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 950 },
    ],
    servings: [
      {
        name_fa: '۱ قاشق غذاخوری',
        name_en: '1 Tablespoon',
        weight_g: 20,
        household_unit: 'قاشق غذاخوری',
      },
    ],
  },
  {
    external_id: 'item_doogh_traditional',
    slug: 'persian-doogh-yogurt-drink',
    category_id: 'cat_dairy',
    category_slug: 'dairy-eggs',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'دوغ سنتی ایرانی بدون گاز (با نعناع و نمک کم)',
        description: 'نوشیدنی خنک تخمیری ماست با سبزی‌های معطر خشک',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Doogh (Mint Yogurt Drink, Non-Carbonated)',
        description: 'Savory yogurt beverage seasoned with dried mint',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'دوغ' },
      { locale: 'fa', alias: 'دوغ نعنایی' },
      { locale: 'en', alias: 'Doogh' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 28 },
      { nutrient_id: 'nut_protein', amount_per_100g: 1.4 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 1.8 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 1.6 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 55 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 280 },
    ],
    servings: [
      {
        name_fa: '۱ لیوان',
        name_en: '1 Glass',
        weight_g: 250,
        household_unit: 'لیوان',
      },
    ],
  },
  {
    external_id: 'item_cheese_tabriz',
    slug: 'tabriz-liwan-white-cheese',
    category_id: 'cat_dairy',
    category_slug: 'dairy-eggs',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'پنیر سنتی تبریز (لیقوان / گوسفندی در آب‌نمک)',
        description: 'پنیر سفید سنتی شور عمل‌آمده در غارهای طبیعی لیقوان',
      },
      {
        locale: 'en',
        name: 'Traditional Tabriz/Lighvan Persian Sheep Cheese in Brine',
        description: 'Aged brined sheep milk cheese from the Lighvan region',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'پنیر تبریز' },
      { locale: 'fa', alias: 'پنیر لیقوان' },
      { locale: 'en', alias: 'Tabriz Cheese' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 278 },
      { nutrient_id: 'nut_protein', amount_per_100g: 17.5 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 1.8 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 22.4 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 520 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 1100 },
    ],
    servings: [
      {
        name_fa: '۱ قوطی کبریت (۳۰ گرم)',
        name_en: '1 Matchbox size portion (30g)',
        weight_g: 30,
        household_unit: 'قوطی کبریت',
      },
    ],
  },
  {
    external_id: 'item_lentils_cooked',
    slug: 'cooked-brown-lentils',
    category_id: 'cat_legumes',
    category_slug: 'legumes-nuts',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'عدس پخته سنتی ایرانی (آب‌پز ساده)',
        description: 'عدس قهوه‌ای آب‌پز غنی از فیبر و آهن مناسب عدس‌پلو',
      },
      {
        locale: 'en',
        name: 'Cooked Brown Lentils (Boiled Plain)',
        description: 'Nutritious cooked brown lentils, dietary fiber and iron rich',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'عدس پخته' },
      { locale: 'fa', alias: 'عدسی ساده' },
      { locale: 'en', alias: 'Cooked Lentils' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 116 },
      { nutrient_id: 'nut_protein', amount_per_100g: 9.0 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 20.1 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 0.4 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 7.9 },
      { nutrient_id: 'nut_iron', amount_per_100g: 3.3 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 5 },
    ],
    servings: [
      {
        name_fa: '۱ لیوان پخته',
        name_en: '1 Cup Cooked',
        weight_g: 198,
        household_unit: 'لیوان',
      },
      {
        name_fa: '۱ قاشق غذاخوری سرپر',
        name_en: '1 Tablespoon',
        weight_g: 25,
        household_unit: 'قاشق غذاخوری',
      },
    ],
  },
  {
    external_id: 'item_chickpeas_cooked',
    slug: 'cooked-chickpeas',
    category_id: 'cat_legumes',
    category_slug: 'legumes-nuts',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'نخود آب‌پز سنتی (پخته ساده)',
        description: 'نخود گرد ایرانی آب‌پز مناسب آبگوشت و آش',
      },
      {
        locale: 'en',
        name: 'Cooked Chickpeas (Garbanzo Beans)',
        description: 'Tender boiled chickpeas for traditional stews and soups',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'نخود پخته' },
      { locale: 'fa', alias: 'نخود آبگوشتی' },
      { locale: 'en', alias: 'Cooked Chickpeas' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 164 },
      { nutrient_id: 'nut_protein', amount_per_100g: 8.9 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 27.4 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 2.6 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 7.6 },
      { nutrient_id: 'nut_iron', amount_per_100g: 2.9 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 49 },
    ],
    servings: [
      {
        name_fa: '۱ لیوان پخته',
        name_en: '1 Cup Cooked',
        weight_g: 164,
        household_unit: 'لیوان',
      },
    ],
  },
  {
    external_id: 'item_walnuts_persian',
    slug: 'persian-walnuts-raw',
    category_id: 'cat_legumes',
    category_slug: 'legumes-nuts',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'مغز گردوی خام ایرانی (تویسرکان / دماوند)',
        description: 'مغز گردوی روغنی تازه و خام سرشار از اسیدهای چرب امگا-۳',
      },
      {
        locale: 'en',
        name: 'Raw Persian Walnuts Halves',
        description: 'Premium raw walnut kernels high in ALA omega-3 fatty acids',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'گردو' },
      { locale: 'fa', alias: 'مغز گردو' },
      { locale: 'en', alias: 'Persian Walnuts' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 654 },
      { nutrient_id: 'nut_protein', amount_per_100g: 15.2 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 13.7 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 65.2 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 6.7 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 98 },
      { nutrient_id: 'nut_iron', amount_per_100g: 2.9 },
    ],
    servings: [
      {
        name_fa: '۲ عدد گردوی کامل (۴ پر گردو)',
        name_en: '2 Whole Walnuts (4 Halves)',
        weight_g: 15,
        household_unit: 'عدد',
      },
      {
        name_fa: '۱ مشت کوچک (۳۰ گرم)',
        name_en: '1 Small Handful (30g)',
        weight_g: 30,
        household_unit: 'مشت',
      },
    ],
  },
  {
    external_id: 'item_joojeh_kabab',
    slug: 'persian-joojeh-kabab-chicken',
    category_id: 'cat_meats',
    category_slug: 'meat-poultry-fish',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'جوجه کباب سنتی ایرانی بدون استخوان (سینه مرغ با زعفران و آبلیمو)',
        description: 'فیله سینه مرغ مرینیت‌شده با زعفران دم‌کرده، پیاز و آبلیمو کباب‌شده',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Saffron Joojeh Kabab (Boneless Breast)',
        description: 'Saffron, lemon and onion marinated grilled chicken breast skewers',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'جوجه کباب' },
      { locale: 'fa', alias: 'جوجه بی‌استخوان' },
      { locale: 'en', alias: 'Joojeh Kabab' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 178 },
      { nutrient_id: 'nut_protein', amount_per_100g: 26.5 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 1.2 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 7.4 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 340 },
      { nutrient_id: 'nut_iron', amount_per_100g: 1.1 },
    ],
    servings: [
      {
        name_fa: '۱ سیخ جوجه کباب (۲۰۰ گرم)',
        name_en: '1 Skewer (200g)',
        weight_g: 200,
        household_unit: 'سیخ',
      },
      {
        name_fa: '۱۰۰ گرم گوشت کباب‌شده',
        name_en: '100g Cooked Meat',
        weight_g: 100,
        household_unit: 'گرم',
      },
    ],
  },
  {
    external_id: 'item_kabab_koobideh',
    slug: 'persian-kabab-koobideh-ground-meat',
    category_id: 'cat_meats',
    category_slug: 'meat-poultry-fish',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'کباب کوبیده سنتی ایرانی (مخلوط گوشت گوسفند و گوساله)',
        description: 'کباب سیخی چرخ‌کرده سنتی با پیاز آب‌گرفته، نمک و زعفران',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Kabab Koobideh (Minced Beef & Lamb)',
        description: 'Minced meat skewer seasoned with grated onion and saffron',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'کوبیده' },
      { locale: 'fa', alias: 'کباب کوبیده' },
      { locale: 'en', alias: 'Kabab Koobideh' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 265 },
      { nutrient_id: 'nut_protein', amount_per_100g: 19.8 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 2.1 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 19.6 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 480 },
      { nutrient_id: 'nut_iron', amount_per_100g: 2.4 },
    ],
    servings: [
      {
        name_fa: '۱ سیخ کباب کوبیده (۱۰۰ گرم)',
        name_en: '1 Skewer (100g)',
        weight_g: 100,
        household_unit: 'سیخ',
      },
    ],
  },
  {
    external_id: 'item_pomegranate_fresh',
    slug: 'persian-fresh-pomegranate',
    category_id: 'cat_fruits',
    category_slug: 'fruits-vegetables',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'انار تازه دانه ایرانی (ساوه / یزد)',
        description: 'دانه‌های یاقوتی انار شیرین و ملس تازه سرشار از پلی‌فنول',
      },
      {
        locale: 'en',
        name: 'Fresh Persian Pomegranate Arils',
        description: 'Juicy ruby pomegranate arils rich in antioxidants',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'انار' },
      { locale: 'fa', alias: 'دانه انار' },
      { locale: 'en', alias: 'Pomegranate' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 83 },
      { nutrient_id: 'nut_protein', amount_per_100g: 1.7 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 18.7 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 1.2 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 4.0 },
      { nutrient_id: 'nut_sugar', amount_per_100g: 13.7 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 3 },
    ],
    servings: [
      {
        name_fa: '۱ لیوان دانه انار',
        name_en: '1 Cup Arils',
        weight_g: 174,
        household_unit: 'لیوان',
      },
      {
        name_fa: '۱ عدد انار متوسط',
        name_en: '1 Medium Fruit',
        weight_g: 150,
        household_unit: 'عدد',
      },
    ],
  },
  {
    external_id: 'item_dates_mazafati',
    slug: 'bam-mazafati-fresh-dates',
    category_id: 'cat_fruits',
    category_slug: 'fruits-vegetables',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'خرما مضافتی بم (رطب سیاه تازه)',
        description: 'رطب مضافتی نرم، گوشتی و مرطوب بم سرشار از پتاسیم',
      },
      {
        locale: 'en',
        name: 'Fresh Bam Mazafati Black Dates (Rotab)',
        description: 'Soft, succulent Iranian dark dates with natural sweetness',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'خرما مضافتی' },
      { locale: 'fa', alias: 'رطب مضافتی' },
      { locale: 'en', alias: 'Mazafati Dates' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 277 },
      { nutrient_id: 'nut_protein', amount_per_100g: 1.8 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 75.0 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 0.2 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 6.7 },
      { nutrient_id: 'nut_sugar', amount_per_100g: 66.5 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 64 },
    ],
    servings: [
      {
        name_fa: '۱ عدد خرما مضافتی',
        name_en: '1 Date',
        weight_g: 12,
        household_unit: 'عدد',
      },
      {
        name_fa: '۳ عدد خرما (یک واحد میوه)',
        name_en: '3 Dates (1 Fruit Portion)',
        weight_g: 36,
        household_unit: 'عدد',
      },
    ],
  },
  {
    external_id: 'item_sabzi_khordan',
    slug: 'persian-fresh-herb-platter-sabzi-khordan',
    category_id: 'cat_fruits',
    category_slug: 'fruits-vegetables',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'سبزی خوردن تازه سنتی ایرانی (تربچه، ریحان، شاهی، جعفری، ترخون، نعناع)',
        description: 'بشقاب سبزیجات تازه سنتی سفره ایرانی کم‌کالری و غنی از ویتامین‌ها',
      },
      {
        locale: 'en',
        name: 'Traditional Persian Fresh Herb Platter (Sabzi Khordan)',
        description: 'Mixed fresh aromatic herbs: basil, tarragon, mint, cress, radish and parsley',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'سبزی خوردن' },
      { locale: 'en', alias: 'Sabzi Khordan' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 25 },
      { nutrient_id: 'nut_protein', amount_per_100g: 2.2 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 4.1 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 0.4 },
      { nutrient_id: 'nut_fiber', amount_per_100g: 2.8 },
      { nutrient_id: 'nut_calcium', amount_per_100g: 140 },
      { nutrient_id: 'nut_iron', amount_per_100g: 3.1 },
    ],
    servings: [
      {
        name_fa: '۱ پیاله / مشت سرپر',
        name_en: '1 Heaping Bowl',
        weight_g: 60,
        household_unit: 'پیاله',
      },
    ],
  },
  {
    external_id: 'item_tea_persian_black',
    slug: 'persian-black-tea-lahijan',
    category_id: 'cat_beverages',
    category_slug: 'traditional-beverages',
    food_type: 'generic',
    status: 'active',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'چای سیاه دم‌کشیده ایرانی (لاهیجان، بدون قند)',
        description: 'چای دم‌کشیده سنتی گیلان بدون شیرین‌کننده',
      },
      {
        locale: 'en',
        name: 'Brewed Persian Black Tea (Lahijan, Unsweetened)',
        description: 'Pure steeped northern Iranian black tea without added sugar',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'چای سیاه' },
      { locale: 'fa', alias: 'چای ایرانی' },
      { locale: 'en', alias: 'Persian Black Tea' },
    ],
    nutrients: [
      { nutrient_id: 'nut_energy', amount_per_100g: 1 },
      { nutrient_id: 'nut_protein', amount_per_100g: 0.1 },
      { nutrient_id: 'nut_carbohydrate', amount_per_100g: 0.2 },
      { nutrient_id: 'nut_fat_total', amount_per_100g: 0 },
      { nutrient_id: 'nut_sodium', amount_per_100g: 3 },
    ],
    servings: [
      {
        name_fa: '۱ استکان / فنجان چای',
        name_en: '1 Persian Tea Glass (Estekan)',
        weight_g: 150,
        household_unit: 'استکان',
      },
      {
        name_fa: '۱ ماگ بزرگ',
        name_en: '1 Large Mug',
        weight_g: 300,
        household_unit: 'ماگ',
      },
    ],
  },
  {
    external_id: 'item_ghormeh_sabzi_draft',
    slug: 'ghormeh-sabzi-traditional-stew',
    category_id: 'cat_stews',
    category_slug: 'traditional-stews-khoresh',
    food_type: 'generic',
    status: 'draft',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'خورش قورمه سبزی سنتی (پیش‌نویس دستور ترکیبی)',
        description:
          'خورش اصیل سبزیجات تفت‌خورده، لیمو عمانی، لوبیا قرمز و گوشت. نیازمند آزمایش آنالیز آزمایشگاهی قبل از فعال‌سازی.',
      },
      {
        locale: 'en',
        name: 'Persian Ghormeh Sabzi Herb Stew (Draft Recipe Composite)',
        description:
          'Classic Persian herb stew with dried limes, red kidney beans and lamb. Maintained as draft pending lab assay.',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'قورمه سبزی' },
      { locale: 'en', alias: 'Ghormeh Sabzi' },
    ],
    servings: [
      {
        name_fa: '۱ کاسه خورش‌خوری متوسط',
        name_en: '1 Medium Stew Bowl',
        weight_g: 220,
        household_unit: 'کاسه',
      },
    ],
  },
  {
    external_id: 'item_gheimeh_draft',
    slug: 'gheimeh-traditional-stew',
    category_id: 'cat_stews',
    category_slug: 'traditional-stews-khoresh',
    food_type: 'generic',
    status: 'draft',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'خورش قیمه سنتی سیب‌زمینی (پیش‌نویس دستور ترکیبی)',
        description:
          'خورش لپه و گوشت با لیمو عمانی و رب گوجه‌فرنگی. در وضعیت پیش‌نویس بدون تخمین ساختگی.',
      },
      {
        locale: 'en',
        name: 'Persian Gheimeh Split Pea Stew (Draft Composite)',
        description:
          'Yellow split pea and beef stew with dried lime. Kept in draft without guessed nutrient values.',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'قیمه' },
      { locale: 'en', alias: 'Gheimeh' },
    ],
    servings: [
      {
        name_fa: '۱ کاسه متوسط',
        name_en: '1 Medium Bowl',
        weight_g: 220,
        household_unit: 'کاسه',
      },
    ],
  },
  {
    external_id: 'item_fesenjan_draft',
    slug: 'fesenjan-walnut-pomegranate-stew',
    category_id: 'cat_stews',
    category_slug: 'traditional-stews-khoresh',
    food_type: 'generic',
    status: 'draft',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'خورش فسنجان گردو و انار (پیش‌نویس دستور ترکیبی)',
        description:
          'خورش سنتی گردوی سابیده و رب انار با مرغ/اردک. وضعیت پیش‌نویس به دلیل تنوع غلظت گردو.',
      },
      {
        locale: 'en',
        name: 'Persian Fesenjan Stew (Walnut & Pomegranate Sauce, Draft)',
        description:
          'Ground walnut and pomegranate molasses stew. Maintained as draft due to ingredient variability.',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'فسنجان' },
      { locale: 'en', alias: 'Fesenjan' },
    ],
    servings: [
      {
        name_fa: '۱ کاسه خورش‌خوری',
        name_en: '1 Stew Bowl',
        weight_g: 200,
        household_unit: 'کاسه',
      },
    ],
  },
  {
    external_id: 'item_ash_reshteh_draft',
    slug: 'ash-reshteh-noodle-soup',
    category_id: 'cat_soups',
    category_slug: 'traditional-soups-ash',
    food_type: 'generic',
    status: 'draft',
    source_id: 'src_open_iranian_foods',
    translations: [
      {
        locale: 'fa',
        name: 'آش رشته سنتی ایرانی (پیش‌نویس غذای ترکیبی)',
        description:
          'آش سنتی حبوبات، سبزیجات معطر، رشته و کشک. وضعیت پیش‌نویس بدون جعل مقادیر مغذی.',
      },
      {
        locale: 'en',
        name: 'Persian Ash Reshteh (Noodle, Herb & Bean Soup, Draft)',
        description:
          'Traditional thick noodle and legume soup. Maintained as draft without fabricated nutrient data.',
      },
    ],
    aliases: [
      { locale: 'fa', alias: 'آش رشته' },
      { locale: 'en', alias: 'Ash Reshteh' },
    ],
    servings: [
      {
        name_fa: '۱ کاسه بزرگ آش',
        name_en: '1 Large Bowl',
        weight_g: 350,
        household_unit: 'کاسه',
      },
    ],
  },
];
