# 🕐 Kenaz Perfumes — Website Monitor

Runs every hour via GitHub Actions. Tests the full D2C flow on **kenazperfumes.com**.
Sends an email alert **only when something breaks** — silent when everything is fine.

---

## What it checks

| # | Check |
|---|-------|
| 1 | Homepage loads (HTTP 200) |
| 2 | Navigation/header is visible |
| 3 | Collection/Shop page loads with products |
| 4 | Product page has title, price, and Add to Cart button |
| 5 | Add to Cart actually works (cart updates) |
| 6 | Cart page accessible |
| 7 | Checkout page reachable |
| 8 | Search returns results |
| 9 | No critical JavaScript errors |
| 10 | Homepage loads within 10 seconds |

---

## Setup (one time only)

### Step 1 — Create the GitHub repo

1. Go to [github.com](https://github.com) → **New repository**
2. Name it `kenaz-monitor` → **Private** → Create
3. Upload all files from this folder into the repo

### Step 2 — Add Gmail App Password

You need a **Gmail App Password** (not your normal password):

1. Go to your Google Account → **Security**
2. Enable **2-Step Verification** (required)
3. Go to **App Passwords** → Select app: Mail → Generate
4. Copy the 16-character password

### Step 3 — Add GitHub Secrets

In your repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these 3 secrets:

| Secret name | Value |
|-------------|-------|
| `MAIL_USERNAME` | your Gmail address (e.g. `yourname@gmail.com`) |
| `MAIL_PASSWORD` | the 16-char App Password from Step 2 |
| `ALERT_EMAIL` | where alerts go (can be same Gmail or any email) |

### Step 4 — Enable Actions

Go to your repo → **Actions** tab → Click **"I understand my workflows, go ahead and enable them"**

That's it! ✅

---

## How it works

```
Every hour at :00
       ↓
GitHub spins up Ubuntu VM
       ↓
Installs Node + Playwright + Chromium
       ↓
Runs 10 tests against kenazperfumes.com
       ↓
All pass? → Nothing happens (silent)
Any fail? → Email sent to ALERT_EMAIL
       ↓
HTML report saved (viewable in Actions tab for 7 days)
```

---

## Manual run

Go to **Actions → 🕐 Kenaz Website Monitor → Run workflow** anytime to trigger instantly.

---

## Local testing

```bash
npm install
npx playwright install chromium
npx playwright test              # headless
npx playwright test --headed     # watch it run in browser
npx playwright show-report       # view HTML report
```

---

## Cost

**Free** — GitHub Actions gives 2,000 minutes/month free for private repos.
This monitor uses ~3 min/run × 24 runs/day × 30 days = ~2,160 min/month.
If you hit the limit, make the repo **public** (unlimited free minutes).
