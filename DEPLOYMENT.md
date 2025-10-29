# Production Deployment Guide

This guide explains how to deploy the Robert Ventures InvestorDesk to production.

## Architecture

- **Frontend**: Netlify (Next.js application)
- **Backend**: Railway (Python FastAPI application)
- **Database**: Supabase (PostgreSQL)

## The Cookie Problem & Solution

When frontend and backend are on different domains, browsers reject cookies with `SameSite=Lax`. This causes logout failures and re-login loops.

**Solution**: Use Netlify as a proxy so all API requests appear to come from the same origin.

## Step-by-Step Deployment

### 1. Deploy Backend to Railway

Your backend should already be deployed. Ensure these environment variables are set in Railway:

```bash
ENVIRONMENT=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-production-jwt-secret
CORS_ORIGINS=https://your-app.netlify.app
```

**⚠️ Critical**: Set `ENVIRONMENT=production` - this enables `SameSite=None` cookies for cross-origin requests.

**To set in Railway**:
- Go to your Railway project dashboard
- Click on your backend service
- Go to "Variables" tab
- Add/update the environment variables above

Or via Railway CLI:
```bash
railway variables set ENVIRONMENT=production
railway variables set CORS_ORIGINS=https://your-app.netlify.app
```

### 2. Update netlify.toml with Backend URL

Edit `netlify.toml` and replace `YOUR-RAILWAY-APP` with your actual Railway deployment URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-actual-app.up.railway.app/api/:splat"
  status = 200
  force = true
  headers = {X-From = "Netlify"}
```

**Example**: If your Railway deployment is `robert-ventures-api.up.railway.app`, use:
```toml
to = "https://robert-ventures-api.up.railway.app/api/:splat"
```

**To find your Railway URL**:
- Go to your Railway project dashboard
- Click on your backend service
- Click on "Settings" → "Domains"
- Copy the public URL (e.g., `something.up.railway.app`)

### 3. Configure Netlify Environment Variables

In your Netlify dashboard (Site settings → Environment variables), add:

```bash
# Supabase (same as Heroku)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# DO NOT SET NEXT_PUBLIC_API_URL in production!
# (We want to use relative paths to leverage the Netlify proxy)
```

**⚠️ Important**: Do NOT set `NEXT_PUBLIC_API_URL` in Netlify. The app should use relative paths (`/api/*`) which Netlify will proxy to Heroku.

### 4. Deploy to Netlify

Push your code to GitHub:

```bash
git add netlify.toml next.config.js lib/apiClient.js app/components/AuthWrapper.js app/components/AdminHeader.js
git commit -m "Fix production logout issue with Netlify proxy"
git push origin main
```

Netlify will automatically rebuild and deploy.

### 5. Verify the Setup

After deployment:

1. **Check Backend Health**:
   - Visit `https://your-app.up.railway.app/health`
   - Should show `"environment": "production"`

2. **Test Login**:
   - Go to your Netlify site
   - Sign in as admin
   - Open browser DevTools → Network tab
   - Login request should go to `https://your-app.netlify.app/api/auth/login` (NOT directly to Railway)

3. **Test Logout**:
   - Click "Sign Out"
   - Check DevTools → Network tab
   - Should see successful logout (200 status)
   - Check Console - no cookie errors
   - Should redirect to sign-in page WITHOUT auto-login

## How It Works

```
User Browser
    ↓
    ↓ Makes request to: /api/auth/login
    ↓
Netlify (your-app.netlify.app)
    ↓
    ↓ Proxy redirects to: https://your-app.up.railway.app/api/auth/login
    ↓
Railway Backend
    ↓
    ↓ Sets cookie with SameSite=None, Secure=true
    ↓
Netlify
    ↓
    ↓ Returns response to browser
    ↓
User Browser
    ✅ Cookie saved (appears to be from same origin: netlify.app)
```

### Why This Works

1. **Same Origin**: Browser sees all requests as `your-app.netlify.app`
2. **Cookies Work**: Because it's same-origin, `SameSite=Lax` or `None` both work
3. **Secure**: Cookies are still `HttpOnly` and `Secure`, protected from XSS

## Troubleshooting

### Issue: Still getting cookie errors

**Check**:
1. Railway env: `ENVIRONMENT=production` ✓
2. Railway env: `CORS_ORIGINS` includes your Netlify URL ✓
3. Netlify: `NEXT_PUBLIC_API_URL` is NOT set ✓
4. `netlify.toml`: Redirect URL is correct ✓

### Issue: API calls failing

**Check browser Network tab**:
- Requests should go to `/api/*` (relative)
- Should show `200` status
- Check Response headers for CORS

**Check Railway logs**:
- Go to Railway dashboard → Your service → "Deployments"
- Click on latest deployment → "View Logs"
- Look for errors or CORS issues

### Issue: Logout still auto-logs in

**Clear browser cache**:
- DevTools → Application → Storage → Clear site data
- Try incognito mode

**Verify cookie deletion**:
- DevTools → Application → Cookies
- Should see `auth_token` cookie disappear after logout

## Security Checklist

- ✅ `ENVIRONMENT=production` on Railway
- ✅ `JWT_SECRET` is strong and unique in production
- ✅ `SUPABASE_SERVICE_KEY` is kept secure (server-only)
- ✅ CORS origins list only includes your production domains
- ✅ Cookies use `Secure=true` in production
- ✅ No sensitive env vars exposed to browser

## Additional Notes

### For Multiple Environments

If you have staging + production:

**Staging**:
- Netlify site: `staging-app.netlify.app`
- Railway deployment: `staging-api.up.railway.app`
- Update `netlify.toml` in staging branch

**Production**:
- Netlify site: `your-app.netlify.app`
- Railway deployment: `production-api.up.railway.app`  
- Update `netlify.toml` in main branch

### Custom Domains

If using custom domains:

1. Update `CORS_ORIGINS` in Railway:
   ```
   CORS_ORIGINS=https://investors.robertventures.com
   ```

2. Update Netlify environment:
   ```
   NEXT_PUBLIC_APP_URL=https://investors.robertventures.com
   ```

3. No changes needed to `netlify.toml` redirect (uses relative paths)

