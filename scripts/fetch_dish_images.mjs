/**
 * Fetches real, dish-relevant photos for every menu surface and optimizes them
 * into the app's local webp assets.
 *
 * Why: dish cards previously pointed at category images, generic combo shots or
 * files that were never downloaded, so many sections fell back to a placeholder
 * instead of a photo of the dish they name.
 *
 * Sources (no API key required):
 *   1. Wikimedia Commons — best keyword relevance for dish names.
 *   2. Openverse        — fallback when Commons has nothing usable.
 *
 * Output matches the existing pipeline: webp, quality 80, sensible max width.
 * The script is idempotent — existing files are skipped, so it is safe to
 * re-run (handy if a batch times out mid-way).
 *
 *   node scripts/fetch_dish_images.mjs            # every missing target
 *   node scripts/fetch_dish_images.mjs --limit 12 # at most 12 per run
 *   node scripts/fetch_dish_images.mjs --force    # re-download everything
 *   node scripts/fetch_dish_images.mjs --replace-small # replace tiny dish placeholders
 *   node scripts/fetch_dish_images.mjs --force --files garden-salad,watermelon-lemonade
 */

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');
const CREDITS_PATH = path.join(IMAGES_DIR, 'CREDITS.md');
const CREDITS_JSON = path.join(IMAGES_DIR, 'image-credits.json');
const USER_AGENT = 'SnackPodImageFetcher/1.0 (dev image tooling; contact: dev@snackpod.local)';
const REQUEST_DELAY_MS = 400;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const REPLACE_SMALL = args.includes('--replace-small');
const SMALL_DISH_IMAGE_BYTES = 8_000;
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : Infinity;
})();
const FILES_INDEX = args.indexOf('--files');
const FILE_FILTER =
  FILES_INDEX >= 0
    ? new Set((args[FILES_INDEX + 1] || '').split(',').map((file) => file.trim()).filter(Boolean))
    : null;

/**
 * Every target that needs a real dish photo. `file` is the output basename
 * (without .webp) and `query` is the search phrase used to find the photo.
 */
const TARGETS = [
  // ── Dishes referenced by src/lib/menu-data.ts ───────────────────────────
  { dir: 'dishes', file: 'zinger-burger', query: 'chicken burger', width: 600 },
  { dir: 'dishes', file: 'veggie-burger', query: 'veggie burger', width: 600 },
  { dir: 'dishes', file: 'nashville-burger', query: 'fried chicken burger', width: 600 },
  { dir: 'dishes', file: 'stir-fry', query: 'vegetable stir fry', width: 600 },
  { dir: 'dishes', file: 'cauliflower-tikka', query: 'cauliflower curry', width: 600 },
  { dir: 'dishes', file: 'black-bean-tacos', query: 'black bean tacos', width: 600 },
  { dir: 'dishes', file: 'calamari', query: 'fried calamari', width: 600 },
  { dir: 'dishes', file: 'scallops', query: 'seared scallops', width: 600 },
  { dir: 'dishes', file: 'prawn-tempura', query: 'prawn tempura', width: 600 },
  { dir: 'dishes', file: 'grilled-fish', query: 'grilled salmon steak', width: 600 },
  { dir: 'dishes', file: 'veg-chili', query: 'vegetarian chili', width: 600 },
  { dir: 'dishes', file: 'acorn-squash', query: 'stuffed acorn squash', width: 600 },
  { dir: 'dishes', file: 'lentil-soup', query: 'lentil soup', width: 600 },
  { dir: 'dishes', file: 'butternut-squash-soup', query: 'butternut squash soup', width: 600 },
  { dir: 'dishes', file: 'ribeye', query: 'grilled ribeye steak', width: 600 },
  { dir: 'dishes', file: 'tandoori-chicken', query: 'tandoori chicken', width: 600 },
  { dir: 'dishes', file: 'caesar-salad', query: 'caesar salad', width: 600 },
  { dir: 'dishes', file: 'quinoa-salad', query: 'quinoa salad', width: 600 },
  { dir: 'dishes', file: 'mango-lassi', query: 'mango lassi', avoid: /butter milk|tea|festival|pakora|costco|making/, width: 600 },
  { dir: 'dishes', file: 'classic-pepsi', query: 'cola glass ice', width: 600 },
  { dir: 'dishes', file: 'chocolate-lava-cake', query: 'chocolate lava cake', width: 600 },
  { dir: 'dishes', file: 'tiramisu', query: 'tiramisu', width: 600 },
  { dir: 'dishes', file: 'butter-chicken-biryani', query: 'chicken biryani', width: 600 },
  { dir: 'dishes', file: 'paneer-biryani', query: 'paneer biryani', width: 600 },
  { dir: 'dishes', file: 'dal-makhani', query: 'dal makhani', width: 600 },
  { dir: 'dishes', file: 'rogan-josh', query: 'rogan josh', width: 600 },
  { dir: 'dishes', file: 'ravioli', query: 'ravioli', width: 600 },
  { dir: 'dishes', file: 'zucchini-pesto', query: 'zoodles', avoid: /chicken|sausage|bolognese|grouper|beef|street/, width: 600 },
  { dir: 'dishes', file: 'coleslaw', query: 'coleslaw', width: 600 },
  { dir: 'dishes', file: 'onion-rings', query: 'onion rings', width: 600 },
  { dir: 'dishes', file: 'spring-rolls', query: 'spring rolls', width: 600 },
  { dir: 'dishes', file: 'paneer-tikka', query: 'paneer tikka', width: 600 },

  // ── Dishes served by the DB catalog (prisma/seed.js) ─────────────────────
  { dir: 'dishes', file: 'chicken-nuggets', query: 'chicken nuggets', width: 600 },
  { dir: 'dishes', file: 'loaded-nachos', query: 'nachos cheese', width: 600 },
  { dir: 'dishes', file: 'fresh-lime-soda', query: 'limeade mint glass', width: 600 },
  { dir: 'dishes', file: 'choco-lava-shake', query: 'chocolate milkshake', width: 600 },
  { dir: 'dishes', file: 'grilled-chicken-combo', query: 'grilled chicken plate', width: 600 },
  { dir: 'dishes', file: '3', query: 'burger fries meal tray', avoid: /child|enjoys|people|man|woman|boy|girl|family|eating/, width: 600 },
  { dir: 'dishes', file: '1', query: 'chicken burger fries cola meal', width: 600 },
  { dir: 'dishes', file: '2', query: 'family burger meal fries', width: 600 },
  { dir: 'dishes', file: 'dish_48', query: 'burger fries meal top view food', avoid: /person|woman|man|interior|building|sign/, width: 600 },
  { dir: 'dishes', file: 'alfredo-pasta', query: 'fettuccine alfredo pasta', width: 600 },
  { dir: 'dishes', file: 'bbq-burger', query: 'barbecue cheeseburger', width: 600 },
  { dir: 'dishes', file: 'bbq-wings', query: 'barbecue chicken wings', width: 600 },
  { dir: 'dishes', file: 'chickpea-curry', query: 'chickpea curry chana masala', width: 600 },
  { dir: 'dishes', file: 'cold-coffee-frappe', query: 'iced coffee frappe', width: 600 },
  { dir: 'dishes', file: 'corn-on-cob', query: 'grilled corn on the cob', width: 600 },
  { dir: 'dishes', file: 'corn-tomato-fritters', query: 'corn pakora', avoid: /bacon|egg|lake|tour|historical|book|cookery/, width: 600 },
  { dir: 'dishes', file: 'cream-mushroom-soup', query: 'cream of mushroom soup', width: 600 },
  { dir: 'dishes', file: 'crispy-corn', query: 'fried corn kernels food', avoid: /corn dog|hot dog|sausage|egg|book|advert/, width: 600 },
  { dir: 'dishes', file: 'eggplant-parmesan', query: 'eggplant parmesan', width: 600 },
  { dir: 'dishes', file: 'garden-salad', query: 'green salad lettuce tomato bowl', avoid: /pork|chicken|ham|meat|book|wrap|sandwich/, width: 600 },
  { dir: 'dishes', file: 'garlic-bread', query: 'garlic bread', avoid: /oyster|seafood|avocado/, width: 600 },
  { dir: 'dishes', file: 'greek-wraps', query: 'falafel pita sandwich', avoid: /chicken|beef|lamb|easter|church|landscape|travel/, width: 600 },
  { dir: 'dishes', file: 'gulab-cheesecake', query: 'cheesecake dessert', width: 600 },
  { dir: 'dishes', file: 'hara-bhara-kebab', query: 'hara bhara kebab', width: 600 },
  { dir: 'dishes', file: 'lamb-chops', query: 'grilled lamb chops', width: 600 },
  { dir: 'dishes', file: 'molten-brownie', query: 'molten chocolate brownie dessert', width: 600 },
  { dir: 'dishes', file: 'mushroom-risotto', query: 'mushroom risotto', width: 600 },
  { dir: 'dishes', file: 'penne-arrabbiata', query: 'penne arrabbiata pasta', width: 600 },
  { dir: 'dishes', file: 'peri-peri-fries', query: 'peri peri french fries', width: 600 },
  { dir: 'dishes', file: 'salted-fries', query: 'french fries bowl', avoid: /hamburger|cheeseburger|burger/, width: 600 },
  { dir: 'dishes', file: 'stuffed-peppers', query: 'stuffed bell pepper rice vegetables', avoid: /clam|shellfish|seafood|yuzu/, width: 600 },
  { dir: 'dishes', file: 'tomato-basil-soup', query: 'tomato basil soup', width: 600 },
  { dir: 'dishes', file: 'watermelon-lemonade', query: 'watermelon lemonade drink glass', avoid: /cookery|book|cookbook|illustration|drawing/, width: 600 },

  // ── Home page category tiles (src/app/components/CategoryBrowser.tsx) ────
  { dir: 'categories', file: 'cat_main-course', query: 'main course dish plate', width: 400 },
  { dir: 'categories', file: 'cat_seafood', query: 'seafood platter', width: 400 },
  { dir: 'categories', file: 'cat_vegetarian', query: 'vegetarian dish vegetables', width: 400 },
  { dir: 'categories', file: 'cat_soups', query: 'soup in bowl vegetables', width: 400 },
  { dir: 'categories', file: 'cat_salads', query: 'salad bowl fresh', width: 400 },
  { dir: 'categories', file: 'cat_pasta', query: 'pasta dish', width: 400 },
  { dir: 'categories', file: 'cat_starters', query: 'appetizer platter', width: 400 },

  // ── Promo / deal banners ────────────────────────────────────────────────
  { dir: 'banners', file: 'promo_1', query: 'noodles bowl asian', width: 800 },
  { dir: 'banners', file: 'promo_2', query: 'pasta tomato basil', width: 800 },
  { dir: 'banners', file: 'promo_3', query: 'cheesecake berries', width: 800 },
  { dir: 'banners', file: 'deal_2', query: 'cheeseburger', width: 800 },
  { dir: 'banners', file: 'newsletter_2', query: 'waffle with strawberries and cream', avoid: /mickey|mouse|sausage|disney|kids|child|stand|fair|world|19[0-9]{2}|restaurant/, width: 600 },
];

const BAD_TITLE = /\b(logo|map|menu|packaging|label|diagram|chart|sketch|drawing|painting|cartoon|poster|sign|billboard|storefront|illustration|icon|clipart|screenshot|stamp|coin|banknote|book|cover|postage|museum|ceramic|porcelain|met|antique)\b/;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeTitle(raw) {
  return String(raw || '')
    .replace(/^File:/i, '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Heuristic relevance/quality score for a candidate photo. */
function scoreCandidate(candidate, query, avoid) {
  const title = normalizeTitle(candidate.title);
  if (BAD_TITLE.test(title) || (avoid && avoid.test(title))) return Number.NEGATIVE_INFINITY;
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);

  let score = 0;
  if (title.includes(q)) score += 8;
  for (const word of words) {
    if (title.includes(word)) score += 3;
  }
  const w = candidate.width || 0;
  const h = candidate.height || 0;
  if (w > h) score += 2; // landscape suits the dish cards
  if (h > w * 1.3) score -= 2; // very tall crops badly
  if (w >= 1000) score += 1;
  if (w < 500 || h < 300) score -= 6;

  return score;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return JSON.parse(text);
}

/** Wikimedia Commons search — strongest dish-name relevance. */
async function searchCommons(query, limit = 10) {
  const url =
    'https://commons.wikimedia.org/w/api.php?' +
    new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `filetype:bitmap ${query}`,
      gsrlimit: String(limit),
      gsrnamespace: '6',
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata',
      iiurlwidth: '1200',
      format: 'json',
      origin: '*',
    });

  const json = await fetchJson(url);
  const pages = json?.query?.pages ? Object.values(json.query.pages).sort((a, b) => a.index - b.index) : [];

  return pages
    .map((page) => {
      const info = page.imageinfo?.[0] ?? {};
      return {
        title: page.title,
        url: info.thumburl || info.url,
        originalUrl: info.url,
        width: info.thumbwidth || info.width,
        height: info.thumbheight || info.height,
        license: info.extmetadata?.LicenseShortName?.value,
        page: info.descriptionurl,
        source: 'Wikimedia Commons',
      };
    })
    .filter((candidate) => candidate.url);
}

/** Openverse search — used when Commons comes up empty or useless. */
async function searchOpenverse(query, limit = 10) {
  const url =
    'https://api.openverse.org/v1/images/?' +
    new URLSearchParams({
      q: query,
      page_size: String(limit),
      license: 'cc0,pdm,by,by-sa',
      mature: 'false',
    });

  const json = await fetchJson(url);
  return (json?.results ?? [])
    .map((item) => ({
      title: item.title || '',
      url: item.thumbnail || item.url,
      originalUrl: item.url,
      width: item.width,
      height: item.height,
      license: item.license ? `${item.license.toUpperCase()} ${item.license_version || ''}`.trim() : undefined,
      page: item.foreign_landing_url || item.url,
      source: 'Openverse',
    }))
    .filter((candidate) => candidate.url);
}

async function pickBest(query, avoid) {
  for (const search of [searchOpenverse, searchCommons]) {
    try {
      const candidates = await search(query);
      await sleep(REQUEST_DELAY_MS);
      if (!candidates.length) continue;

      candidates.sort((a, b) => scoreCandidate(b, query, avoid) - scoreCandidate(a, query, avoid));
      const best = candidates[0];
      if (scoreCandidate(best, query, avoid) > 0) return best;
    } catch (error) {
      console.warn(`  ! ${search.name} failed for "${query}": ${error.message}`);
      await sleep(REQUEST_DELAY_MS);
    }
  }
  return null;
}

async function downloadImage(url, absolutePath, maxWidth) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  await sharp(buffer)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toFile(absolutePath);

  return fs.statSync(absolutePath).size;
}

async function downloadCandidate(candidate, absolutePath, maxWidth) {
  const urls = [...new Set([candidate.url, candidate.originalUrl].filter(Boolean))];
  let lastError;
  for (const url of urls) {
    try {
      return await downloadImage(url, absolutePath, maxWidth);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('No image URL was available');
}

function sanitizeMarkdown(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Credit entries persist in image-credits.json. If only the older markdown
 * file exists (pre-JSON runs), seed the store from its table rows.
 */
function loadCreditsStore() {
  if (fs.existsSync(CREDITS_JSON)) {
    return JSON.parse(fs.readFileSync(CREDITS_JSON, 'utf8'));
  }
  const store = {};
  if (!fs.existsSync(CREDITS_PATH)) return store;

  for (const line of fs.readFileSync(CREDITS_PATH, 'utf8').split('\n')) {
    const match = line.match(/^\| `([^`]+)` \| (.*?) \(\[source\]\((.*?)\)\) \| (.*?) \| (.*?) \|$/);
    if (!match) continue;
    const [, file, title, page, source, license] = match;
    store[file] = { file, title, page, source, license, query: '' };
  }
  return store;
}

async function main() {
  let processed = 0;
  let created = 0;
  const credits = [];
  const targetsToProcess = FILE_FILTER
    ? TARGETS.filter((target) => FILE_FILTER.has(target.file))
    : TARGETS;

  if (FILE_FILTER && targetsToProcess.length !== FILE_FILTER.size) {
    const knownFiles = new Set(TARGETS.map((target) => target.file));
    const unknownFiles = [...FILE_FILTER].filter((file) => !knownFiles.has(file));
    throw new Error(`Unknown image target(s): ${unknownFiles.join(', ') || 'duplicate target names'}`);
  }

  for (const target of targetsToProcess) {
    if (processed >= LIMIT) break;

    const targetDir = path.join(IMAGES_DIR, target.dir);
    fs.mkdirSync(targetDir, { recursive: true });
    const absolutePath = path.join(targetDir, `${target.file}.webp`);

    if (fs.existsSync(absolutePath) && !FORCE) {
      const existingBytes = fs.statSync(absolutePath).size;
      const isSmallDishPlaceholder =
        REPLACE_SMALL &&
        target.dir === 'dishes' &&
        existingBytes <= SMALL_DISH_IMAGE_BYTES;
      if (!isSmallDishPlaceholder) continue;
    }

    processed += 1;
    console.log(`→ ${target.dir}/${target.file}  (searching "${target.query}")`);

    const chosen = await pickBest(target.query, target.avoid);
    if (!chosen) {
      console.warn(`  ✗ no usable photo found for "${target.query}"`);
      continue;
    }

    try {
      const bytes = await downloadCandidate(chosen, absolutePath, target.width);
      created += 1;
      console.log(
        `  ✓ ${chosen.source}: ${sanitizeMarkdown(chosen.title).slice(0, 60)} (${Math.round(bytes / 1024)} KB)`
      );
      credits.push({
        file: `/images/${target.dir}/${target.file}.webp`,
        query: target.query,
        title: sanitizeMarkdown(chosen.title),
        source: chosen.source,
        page: chosen.page,
        license: sanitizeMarkdown(chosen.license) || 'see source page',
      });
    } catch (error) {
      console.warn(`  ✗ download failed: ${error.message}`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  if (credits.length) {
    const store = loadCreditsStore();
    for (const entry of credits) store[entry.file] = entry;

    fs.writeFileSync(CREDITS_JSON, JSON.stringify(store, null, 2), 'utf8');

    const header = [
      '# Image credits',
      '',
      'Dish, category and banner photos bundled in `public/images/`. Each entry lists',
      'the source page where the original photo and its license can be verified.',
      '',
      '| Asset | Photo | Source | License |',
      '| --- | --- | --- | --- |',
    ].join('\n');

    const rows = Object.keys(store)
      .sort()
      .map((file) => {
        const c = store[file];
        return `| \`${file}\` | ${c.title} ([source](${c.page})) | ${c.source} | ${c.license} |`;
      })
      .join('\n');

    fs.writeFileSync(CREDITS_PATH, `${header}\n${rows}\n`, 'utf8');
  }

  console.log(
    `\nDone. processed=${processed} created=${created} remainingTargets=${targetsToProcess.length}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
