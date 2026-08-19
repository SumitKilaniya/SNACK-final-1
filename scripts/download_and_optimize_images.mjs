import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'public', 'images');

const dirs = ['dishes', 'categories', 'banners', 'hero', 'auth', 'avatars'];
dirs.forEach(d => {
  const dirPath = path.join(PUBLIC_IMAGES_DIR, d);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

async function downloadAndOptimize(url, targetSubdir, filename, maxWidth = 600) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return url;
  }
  const outFileName = filename.endsWith('.webp') ? filename : `${filename}.webp`;
  const relPath = `/images/${targetSubdir}/${outFileName}`;
  const absolutePath = path.join(PUBLIC_IMAGES_DIR, targetSubdir, outFileName);

  if (fs.existsSync(absolutePath)) {
    return relPath;
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status} for ${url}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    
    await sharp(buffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toFile(absolutePath);

    const stats = fs.statSync(absolutePath);
    console.log(`Downloaded & Optimized: ${url} -> ${relPath} (${Math.round(stats.size / 1024)} KB)`);
    return relPath;
  } catch (err) {
    console.error(`Failed for ${url}:`, err.message);
    return null;
  }
}

async function run() {
  console.log('Starting full image processing...');
  const urlMap = {};

  // 1. Menu data dishes & combos
  const menuDataPath = path.join(process.cwd(), 'src', 'lib', 'menu-data.ts');
  let menuDataContent = fs.readFileSync(menuDataPath, 'utf8');

  // Match key and image for dishes
  // key: '...', ... image: '...'
  const dishBlocks = menuDataContent.split('{\n').filter(b => b.includes("image:"));
  for (const block of dishBlocks) {
    const keyMatch = block.match(/key:\s*'([^']+)'/) || block.match(/id:\s*([0-9]+)/);
    const imgMatch = block.match(/image:\s*'([^']+)'/);
    if (keyMatch && imgMatch) {
      const key = keyMatch[1];
      const url = imgMatch[1];
      const localPath = await downloadAndOptimize(url, 'dishes', key, 600);
      if (localPath) {
        urlMap[url] = localPath;
      }
    }
  }

  // Also catch any standalone URLs in menu-data
  const allUrlsInMenu = [...menuDataContent.matchAll(/'(https:\/\/[^']+)'/g)];
  for (let i = 0; i < allUrlsInMenu.length; i++) {
    const url = allUrlsInMenu[i][1];
    if (!urlMap[url]) {
      const localPath = await downloadAndOptimize(url, 'dishes', `item_extra_${i + 1}`, 600);
      if (localPath) {
        urlMap[url] = localPath;
      }
    }
  }

  // 2. CategoryBrowser.tsx
  const categoryBrowserPath = path.join(process.cwd(), 'src', 'app', 'components', 'CategoryBrowser.tsx');
  let catContent = fs.readFileSync(categoryBrowserPath, 'utf8');
  const catMatches = [...catContent.matchAll(/id:\s*'([^']+)',[\s\S]*?image:\s*'([^']+)'/g)];
  for (const match of catMatches) {
    const [, id, url] = match;
    const localPath = await downloadAndOptimize(url, 'categories', `cat_${id}`, 400);
    if (localPath) {
      urlMap[url] = localPath;
    }
  }

  // 3. HeroSection.tsx
  const heroPath = path.join(process.cwd(), 'src', 'app', 'components', 'HeroSection.tsx');
  let heroContent = fs.readFileSync(heroPath, 'utf8');
  const heroMatches = [...heroContent.matchAll(/src="(https:\/\/[^"]+)"/g)];
  for (const match of heroMatches) {
    const url = match[1];
    const localPath = await downloadAndOptimize(url, 'hero', 'hero_dish', 800);
    if (localPath) {
      urlMap[url] = localPath;
    }
  }

  // 4. DealBanner.tsx
  const dealPath = path.join(process.cwd(), 'src', 'app', 'components', 'DealBanner.tsx');
  let dealContent = fs.readFileSync(dealPath, 'utf8');
  const dealMatches = [...dealContent.matchAll(/image:\s*'([^']+)'/g)];
  for (let i = 0; i < dealMatches.length; i++) {
    const url = dealMatches[i][1];
    const localPath = await downloadAndOptimize(url, 'banners', `deal_${i + 1}`, 800);
    if (localPath) {
      urlMap[url] = localPath;
    }
  }

  // 5. PromoBanners.tsx
  const promoPath = path.join(process.cwd(), 'src', 'app', 'components', 'PromoBanners.tsx');
  let promoContent = fs.readFileSync(promoPath, 'utf8');
  const promoMatches = [...promoContent.matchAll(/image:\s*'([^']+)'/g)];
  for (let i = 0; i < promoMatches.length; i++) {
    const url = promoMatches[i][1];
    const localPath = await downloadAndOptimize(url, 'banners', `promo_${i + 1}`, 800);
    if (localPath) {
      urlMap[url] = localPath;
    }
  }

  // 6. NewsletterSection.tsx
  const newsPath = path.join(process.cwd(), 'src', 'app', 'components', 'NewsletterSection.tsx');
  let newsContent = fs.readFileSync(newsPath, 'utf8');
  const newsMatches = [...newsContent.matchAll(/src="(https:\/\/[^"]+)"/g)];
  for (let i = 0; i < newsMatches.length; i++) {
    const url = newsMatches[i][1];
    const localPath = await downloadAndOptimize(url, 'banners', `newsletter_${i + 1}`, 600);
    if (localPath) {
      urlMap[url] = localPath;
    }
  }

  // 7. Auth page
  const authPath = path.join(process.cwd(), 'src', 'app', 'auth', 'page.tsx');
  let authContent = fs.readFileSync(authPath, 'utf8');
  const authMatches = [...authContent.matchAll(/src="(https:\/\/[^"]+)"/g)];
  for (let i = 0; i < authMatches.length; i++) {
    const url = authMatches[i][1];
    const localPath = await downloadAndOptimize(url, 'auth', `auth_banner_${i + 1}`, 1000);
    if (localPath) {
      urlMap[url] = localPath;
    }
  }

  // 8. Auth context avatar
  const authCtxPath = path.join(process.cwd(), 'src', 'lib', 'auth-context.tsx');
  let authCtxContent = fs.readFileSync(authCtxPath, 'utf8');
  const avatarMatches = [...authCtxContent.matchAll(/'(https:\/\/[^']+)'/g)];
  for (let i = 0; i < avatarMatches.length; i++) {
    const url = avatarMatches[i][1];
    const localPath = await downloadAndOptimize(url, 'avatars', `default_avatar`, 200);
    if (localPath) {
      urlMap[url] = localPath;
    }
  }

  fs.writeFileSync(path.join(process.cwd(), 'url_mapping.json'), JSON.stringify(urlMap, null, 2));
  console.log('Saved URL mapping to url_mapping.json');

  // Automatically replace in source files
  const filesToUpdate = [
    menuDataPath,
    categoryBrowserPath,
    heroPath,
    dealPath,
    promoPath,
    newsPath,
    authPath,
    authCtxPath
  ];

  for (const filePath of filesToUpdate) {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let replacedCount = 0;
      for (const [remoteUrl, localAsset] of Object.entries(urlMap)) {
        if (content.includes(remoteUrl)) {
          content = content.replaceAll(remoteUrl, localAsset);
          replacedCount++;
        }
      }
      if (replacedCount > 0) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath} (${replacedCount} URLs replaced)`);
      }
    }
  }
}

run();
