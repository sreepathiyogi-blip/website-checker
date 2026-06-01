const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kenazperfumes.com';
const TIMEOUT = 30000;

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

  // ─── 2. Navigation / Menu works ──────────────────────────────────────
  test('Navigation menu is visible', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const nav = page.locator('nav, header, [role="navigation"], .header, #header').first();
    await expect(nav).toBeVisible({ timeout: TIMEOUT });
    console.log('✅ Navigation is visible');
  });

  // ─── 3. Collection page loads with products ───────────────────────────
  test('Collection/Shop page loads with products', async ({ page }) => {
    const collectionUrls = [
      `${BASE_URL}/collections/all`,
      `${BASE_URL}/collections`,
      `${BASE_URL}/shop`,
    ];

    let loaded = false;
    for (const url of collectionUrls) {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }).catch(() => null);
      if (res && res.status() === 200) { loaded = true; break; }
    }
    expect(loaded, 'No collection/shop page found').toBe(true);

    // Wait for products to render
    await page.waitForTimeout(2000);

    const productCards = page.locator('.product-card, .product-item, .product, [class*="product"], .card, article');
    const count = await productCards.count();
    expect(count, 'No product cards found on collection page').toBeGreaterThan(0);
    console.log(`✅ Collection page loaded with ${count} products`);
  });

  // ─── 4. Product page loads ────────────────────────────────────────────
  test('Product page loads with Add to Cart button', async ({ page }) => {
    await page.goto(`${BASE_URL}/collections/all`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
      .catch(() => page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }));

    await page.waitForTimeout(2000);

    // Only pick links that are VISIBLE (exclude hidden nav/menu links)
    const productLink = page.locator('a[href*="/products/"]:visible').first();
    await expect(productLink).toBeVisible({ timeout: TIMEOUT });
    
    const href = await productLink.getAttribute('href');
    console.log(`  → Navigating to product: ${href}`);
    
    // Navigate directly to the product URL instead of clicking (avoids hidden element issues)
    const productUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Wait for network and additional rendering
    await page.waitForLoadState('networkidle').catch(() => null);
    await page.waitForTimeout(1000);

    expect(page.url()).toContain('/products/');

    // Use more flexible locator strategy for product title
    const productTitle = page.locator('h1, h2, [class*="product-title"], [class*="product-name"], .title').first();
    
    // Add debugging for title detection
    const titleCount = await page.locator('h1, h2, [class*="product-title"], [class*="product-name"], .title').count();
    console.log(`  → Found ${titleCount} potential title elements`);
    
    await expect(productTitle).toBeVisible({ timeout: TIMEOUT });

    // More flexible price locator
    const price = page.locator('[class*="price"], .price, [data-price], span:has-text("$")').first();
    await expect(price).toBeVisible({ timeout: TIMEOUT });

    const addToCart = page.locator(
      'button[name="add"], button:has-text("Add to cart"), button:has-text("Add to Cart"), [class*="add-to-cart"]'
    ).first();
    await expect(addToCart).toBeVisible({ timeout: TIMEOUT });
    await expect(addToCart).toBeEnabled({ timeout: TIMEOUT });

    console.log(`✅ Product page OK — "${await productTitle.innerText()}" | Add to Cart visible`);
  });

  // ─── 5. Add to Cart works ─────────────────────────────────────────────
  test('Add to Cart functionality works', async ({ page }) => {
    await page.goto(`${BASE_URL}/collections/all`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
      .catch(() => page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }));

    await page.waitForTimeout(2000);

    // Get first visible product URL and navigate directly
    const productLink = page.locator('a[href*="/products/"]:visible').first();
    const href = await productLink.getAttribute('href');
    const productUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const addToCart = page.locator(
      'button[name="add"], button:has-text("Add to cart"), button:has-text("Add to Cart"), [class*="add-to-cart"]'
    ).first();
    await expect(addToCart).toBeVisible({ timeout: TIMEOUT });
    await addToCart.click();
    await page.waitForTimeout(3000);

    // Accept any cart signal: counter, drawer, or redirect to /cart
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
    // Add item via direct product navigation
    await page.goto(`${BASE_URL}/collections/all`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
      .catch(() => page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }));

    await page.waitForTimeout(2000);

    const productLink = page.locator('a[href*="/products/"]:visible').first();
    const href = await productLink.getAttribute('href');
    const productUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const addToCart = page.locator(
      'button[name="add"], button:has-text("Add to cart"), button:has-text("Add to Cart"), [class*="add-to-cart"]'
    ).first();
    await expect(addToCart).toBeVisible({ timeout: TIMEOUT });
    await addToCart.click();
    await page.waitForTimeout(3000);

    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const finalUrl = page.url();
    const isCheckout = finalUrl.includes('/checkout') || finalUrl.includes('shopify.com/checkouts');
    expect(isCheckout, `Checkout URL unexpected: ${finalUrl}`).toBe(true);
    console.log(`✅ Checkout reachable — ${finalUrl}`);
  });

  // ─── 8. Search works ─────────────────────────────────────────────────
  test('Search functionality works', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Try direct search URL — most reliable for Shopify
    const searchRes = await page.goto(`${BASE_URL}/search?q=perfume`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    expect(searchRes.status(), 'Search page returned non-200').toBe(200);
    expect(page.url()).toContain('search');
    
    const body = await page.locator('body').innerText();
    expect(body.trim().length, 'Search results page is empty').toBeGreaterThan(50);
    console.log('✅ Search page works');
  });

  // ─── 9. No critical JS errors on homepage ────────────────────────────
  test('No critical JS errors on homepage', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Use domcontentloaded — networkidle times out on Shopify (analytics scripts never settle)
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
      !e.includes('shopify_pay')
    );

    if (criticalErrors.length > 0) {
      console.warn('⚠️  JS Errors:', criticalErrors);
    }
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
