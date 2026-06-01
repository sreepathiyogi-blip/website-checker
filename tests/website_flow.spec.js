const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://kenazperfumes.com';
const TIMEOUT = 30000;

test.describe('Kenaz Perfumes - D2C Flow Monitor', () => {

  // ─── 1. Homepage loads ───────────────────────────────────────────────
  test('Homepage loads correctly', async ({ page }) => {
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    expect(response.status(), 'Homepage returned non-200 status').toBe(200);

    // Title should exist
    const title = await page.title();
    expect(title.length, 'Page title is empty').toBeGreaterThan(0);

    // No broken layout — body should have content
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length, 'Homepage body is empty').toBeGreaterThan(50);

    console.log(`✅ Homepage loaded — "${title}"`);
  });

  // ─── 2. Navigation / Menu works ──────────────────────────────────────
  test('Navigation menu is visible', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Look for common nav patterns
    const nav = page.locator('nav, header, [role="navigation"], .header, #header').first();
    await expect(nav).toBeVisible({ timeout: TIMEOUT });

    console.log('✅ Navigation is visible');
  });

  // ─── 3. Products / Collection page loads ─────────────────────────────
  test('Collection/Shop page loads with products', async ({ page }) => {
    // Try common Shopify collection URLs
    const collectionUrls = [
      `${BASE_URL}/collections/all`,
      `${BASE_URL}/collections`,
      `${BASE_URL}/shop`,
    ];

    let loaded = false;
    for (const url of collectionUrls) {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }).catch(() => null);
      if (res && res.status() === 200) {
        loaded = true;
        break;
      }
    }

    expect(loaded, 'No collection/shop page found').toBe(true);

    // Products should be visible
    const productCards = page.locator(
      '.product-card, .product-item, .product, [class*="product"], .card, article'
    );
    const count = await productCards.count();
    expect(count, 'No product cards found on collection page').toBeGreaterThan(0);

    console.log(`✅ Collection page loaded with ${count} products`);
  });

  // ─── 4. Individual Product page loads ────────────────────────────────
  test('Product page loads with Add to Cart button', async ({ page }) => {
    // Go to collection first
    await page.goto(`${BASE_URL}/collections/all`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
      .catch(() => page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }));

    // Click first product
    const productLink = page.locator('a[href*="/products/"]').first();
    await expect(productLink).toBeVisible({ timeout: TIMEOUT });
    await productLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Product page checks
    const url = page.url();
    expect(url).toContain('/products/');

    // Product title
    const productTitle = page.locator('h1').first();
    await expect(productTitle).toBeVisible({ timeout: TIMEOUT });

    // Price should be visible
    const price = page.locator('[class*="price"], .price, [data-price]').first();
    await expect(price).toBeVisible({ timeout: TIMEOUT });

    // Add to Cart button must exist and be enabled
    const addToCart = page.locator(
      'button[name="add"], button:has-text("Add to cart"), button:has-text("Add to Cart"), [class*="add-to-cart"]'
    ).first();
    await expect(addToCart).toBeVisible({ timeout: TIMEOUT });
    await expect(addToCart).toBeEnabled({ timeout: TIMEOUT });

    console.log(`✅ Product page OK — "${await productTitle.innerText()}" | Add to Cart button visible`);
  });

  // ─── 5. Add to Cart works ─────────────────────────────────────────────
  test('Add to Cart functionality works', async ({ page }) => {
    await page.goto(`${BASE_URL}/collections/all`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
      .catch(() => page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }));

    // Navigate to first product
    const productLink = page.locator('a[href*="/products/"]').first();
    await productLink.click();
    await page.waitForLoadState('domcontentloaded');

    // Click Add to Cart
    const addToCart = page.locator(
      'button[name="add"], button:has-text("Add to cart"), button:has-text("Add to Cart"), [class*="add-to-cart"]'
    ).first();
    await addToCart.click();

    // Wait for cart update — drawer, counter, or redirect
    await page.waitForTimeout(2000);

    // Check cart count increased OR cart drawer opened OR redirected to cart
    const cartIndicators = [
      page.locator('[class*="cart-count"]:not(:empty)', ),
      page.locator('[class*="cart-item"]'),
      page.locator('.cart-drawer[open], .cart-drawer.is-open, [class*="cart"].is-open'),
    ];

    let cartUpdated = false;
    for (const indicator of cartIndicators) {
      if (await indicator.count() > 0) {
        cartUpdated = true;
        break;
      }
    }

    // Also accept if redirected to /cart
    if (page.url().includes('/cart')) cartUpdated = true;

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

  // ─── 7. Checkout page reachable ──────────────────────────────────────
  test('Checkout is reachable', async ({ page }) => {
    // Add item first so checkout doesn't redirect back
    await page.goto(`${BASE_URL}/collections/all`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
      .catch(() => page.goto(`${BASE_URL}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT }));

    const productLink = page.locator('a[href*="/products/"]').first();
    await productLink.click();
    await page.waitForLoadState('domcontentloaded');

    const addToCart = page.locator(
      'button[name="add"], button:has-text("Add to cart"), button:has-text("Add to Cart"), [class*="add-to-cart"]'
    ).first();
    await addToCart.click();
    await page.waitForTimeout(2000);

    // Go to checkout
    await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    const finalUrl = page.url();
    // Shopify checkout redirects to checkout.shopify.com or stays on /checkout
    const isCheckout = finalUrl.includes('/checkout') || finalUrl.includes('shopify.com/checkouts');
    expect(isCheckout, `Checkout URL unexpected: ${finalUrl}`).toBe(true);

    console.log(`✅ Checkout reachable — ${finalUrl}`);
  });

  // ─── 8. Search works ─────────────────────────────────────────────────
  test('Search functionality works', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

    // Try to find search
    const searchTrigger = page.locator(
      '[aria-label*="search" i], [href*="search"], button:has-text("Search"), input[type="search"], .search-toggle'
    ).first();

    if (await searchTrigger.count() === 0) {
      console.log('⚠️  Search element not found — skipping');
      test.skip();
      return;
    }

    await searchTrigger.click();
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[type="search"], input[name="q"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('perfume');
      await searchInput.press('Enter');
      await page.waitForLoadState('domcontentloaded');

      const url = page.url();
      expect(url.includes('search') || url.includes('q='), 'Search did not navigate to results').toBe(true);
      console.log('✅ Search works');
    } else {
      console.log('⚠️  Search input not found after clicking trigger — skipping');
    }
  });

  // ─── 9. No console errors on homepage ────────────────────────────────
  test('No critical JS errors on homepage', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e =>
      !e.includes('analytics') &&
      !e.includes('gtag') &&
      !e.includes('fbq') &&
      !e.includes('hotjar') &&
      !e.includes('clarity')
    );

    if (criticalErrors.length > 0) {
      console.warn('⚠️  JS Errors found:', criticalErrors);
    }

    expect(criticalErrors.length, `Critical JS errors: ${criticalErrors.join(', ')}`).toBe(0);
    console.log('✅ No critical JS errors on homepage');
  });

  // ─── 10. Page speed / response time ──────────────────────────────────
  test('Homepage loads within 10 seconds', async ({ page }) => {
    const start = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const elapsed = Date.now() - start;

    console.log(`⏱️  Homepage loaded in ${elapsed}ms`);
    expect(elapsed, `Homepage took too long: ${elapsed}ms`).toBeLessThan(10000);
  });

});
