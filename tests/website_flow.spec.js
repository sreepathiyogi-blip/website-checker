const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kenazperfumes.com';
const TIMEOUT = 30000;

// Known product URLs from the site — avoids relying on collection page scraping
const KNOWN_PRODUCT = `${BASE_URL}/products/bayda-100ml`;

async function getFirstProductUrl(page) {
  await page.goto(`${BASE_URL}/collections/all`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
    .catch(() => page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }));
  await page.waitForTimeout(2000);
  const links = await page.locator('a[href*="/products/"]:visible').all();
  for (const link of links) {
    const href = await link.getAttribute('href').catch(() => null);
    if (href && !href.includes('#') && href.includes('/products/')) {
      return href.startsWith('http') ? href : `${BASE_URL}${href}`;
    }
  }
  return KNOWN_PRODUCT;
}

test.describe('Kenaz Perfumes - D2C Flow Monitor', () => {

  // ─── 1. Homepage loads ───────────────────────────────────────────────
  test('Homepage loads correctly', async ({ page }) => {
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    expect(response.status(), 'Homepage returned non-200 status').toBe(200);
    const title = await page.title();
    expect(title.length, 'Page title is empty').toBeGreaterThan(0);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length, 'Homepage body is empty').toBeGreaterThan(50);
    console.log(`✅ Homepage loaded — "${title}"`);
  });

  // ─── 2. Navigation visible ───────────────────────────────────────────
  test('Navigation menu is visible', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const nav = page.locator('nav, header, [role="navigation"], .header, #header').first();
    await expect(nav).toBeVisible({ timeout: TIMEOUT });
    console.log('✅ Navigation is visible');
  });

  // ─── 3. Collection page loads ─────────────────────────────────────────
  test('Collection/Shop page loads with products', async ({ page }) => {
    const collectionUrls = [`${BASE_URL}/collections/all`, `${BASE_URL}/collections/all-products`];
    let loaded = false;
    for (const url of collectionUrls) {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }).catch(() => null);
      if (res && res.status() === 200) { loaded = true; break; }
    }
    expect(loaded, 'No collection/shop page found').toBe(true);
    await page.waitForTimeout(2000);
    const count = await page.locator('a[href*="/products/"]').count();
    expect(count, 'No product links found on collection page').toBeGreaterThan(0);
    console.log(`✅ Collection page has ${count} product links`);
  });

  // ─── 4. Product page loads ────────────────────────────────────────────
  test('Product page loads with Add to Cart button', async ({ page }) => {
    console.log(`  → Navigating to: ${KNOWN_PRODUCT}`);
    const response = await page.goto(KNOWN_PRODUCT, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    expect(response.status()).toBeLessThan(400);
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/products/');

    // Target product title specifically — inside the product info section, not nav drawer
    // Shopify product title is inside #ProductInfo or .product__title or .product-single__title
    const productTitle = page.locator([
      '#ProductInfo-template--22576074096888__main h1',
      '.product__title',
      '.product-single__title',
      '[class*="product"] h1',
      'main h1',
    ].join(', ')).first();

    await expect(productTitle).toBeVisible({ timeout: TIMEOUT });
    const titleText = await productTitle.innerText();
    console.log(`  → Product title: "${titleText}"`);
    expect(titleText.trim().length).toBeGreaterThan(0);

    const price = page.locator('main [class*="price"]:visible, .product__price:visible, [data-price]:visible').first();
    await expect(price).toBeVisible({ timeout: TIMEOUT });

    const addToCart = page.locator(
      'button[name="add"]:visible, button:has-text("Add to cart"):visible, button:has-text("Add to Cart"):visible'
    ).first();
    await expect(addToCart).toBeVisible({ timeout: TIMEOUT });
    await expect(addToCart).toBeEnabled({ timeout: TIMEOUT });

    console.log(`✅ Product page OK — "${titleText}" | Add to Cart visible`);
  });

  // ─── 5. Add to Cart works ─────────────────────────────────────────────
  test('Add to Cart functionality works', async ({ page }) => {
    await page.goto(KNOWN_PRODUCT, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(2000);

    const addToCart = page.locator(
      'button[name="add"]:visible, button:has-text("Add to cart"):visible, button:has-text("Add to Cart"):visible'
    ).first();
    await expect(addToCart).toBeVisible({ timeout: TIMEOUT });
    await addToCart.click();
    await page.waitForTimeout(3000);

    const cartUpdated =
      (await page.locator('[class*="cart-count"]:not(:empty)').count()) > 0 ||
      (await page.locator('[class*="cart-item"]').count()) > 0 ||
      (await page.locator('.cart-drawer[open], [class*="cart"].is-open').count()) > 0 ||
      page.url().includes('/cart');

    expect(cartUpdated, 'Cart did not update after clicking Add to Cart').toBe(true);
    console.log('✅ Add to Cart worked — cart updated');
  });

  // ─── 6. Cart page loads ───────────────────────────────────────────────
  test('Cart page loads correctly', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/cart`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    expect(res.status(), 'Cart page returned non-200').toBe(200);
    const body = await page.locator('body').innerText();
    expect(body.trim().length, 'Cart page body is empty').toBeGreaterThan(20);
    console.log('✅ Cart page loaded');
  });

  // ─── 7. Checkout reachable ────────────────────────────────────────────
  test('Checkout is reachable', async ({ page }) => {
    await page.goto(KNOWN_PRODUCT, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(2000);

    const addToCart = page.locator(
      'button[name="add"]:visible, button:has-text("Add to cart"):visible, button:has-text("Add to Cart"):visible'
    ).first();
    await expect(addToCart).toBeVisible({ timeout: TIMEOUT });
    await addToCart.click();
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const finalUrl = page.url();
    const isCheckout = finalUrl.includes('/checkout') || finalUrl.includes('shopify.com/checkouts') || finalUrl.includes('/checkouts/');
    expect(isCheckout, `Checkout URL unexpected: ${finalUrl}`).toBe(true);
    console.log(`✅ Checkout reachable — ${finalUrl}`);
  });

  // ─── 8. Search works ─────────────────────────────────────────────────
  test('Search functionality works', async ({ page }) => {
    const searchRes = await page.goto(`${BASE_URL}/search?q=perfume`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    expect(searchRes.status(), 'Search page returned non-200').toBe(200);
    expect(page.url()).toContain('search');
    const body = await page.locator('body').innerText();
    expect(body.trim().length, 'Search results page is empty').toBeGreaterThan(50);
    console.log('✅ Search page works');
  });

  // ─── 9. No critical JS errors ────────────────────────────────────────
  test('No critical JS errors on homepage', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(e =>
      !e.includes('analytics') &&
      !e.includes('gtag') &&
      !e.includes('fbq') &&
      !e.includes('hotjar') &&
      !e.includes('clarity') &&
      !e.includes('tiktok') &&
      !e.includes('pixel') &&
      !e.includes('shopify_pay') &&
      !e.includes('marketingAllowed') &&
      !e.includes('Cannot read properties of undefined')
    );

    if (criticalErrors.length > 0) console.warn('⚠️  JS Errors:', criticalErrors);
    expect(criticalErrors.length, `Critical JS errors: ${criticalErrors.join(', ')}`).toBe(0);
    console.log('✅ No critical JS errors on homepage');
  });

  // ─── 10. Page speed ──────────────────────────────────────────────────
  test('Homepage loads within 10 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const elapsed = Date.now() - start;
    console.log(`⏱️  Homepage loaded in ${elapsed}ms`);
    expect(elapsed, `Homepage too slow: ${elapsed}ms`).toBeLessThan(10000);
  });

});
