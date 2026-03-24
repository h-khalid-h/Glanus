Based on your Glanus project architecture (Next.js + PostgreSQL + Redis), here's how to configure EasyPanel:

EasyPanel Project Setup
1. Create the Project
In EasyPanel dashboard → New Project → name it glanus
2. Services to Create (3 total)
Service 1: App (type: App)
Source: GitHub → select h-khalid-h/Glanus repo, branch main
Build: Dockerfile (it will auto-detect your 

Dockerfile
)
Port: 3000
Domain: Add your production domain (e.g. glanus.yourdomain.com) with HTTPS enabled
Environment Variables — set all of these:
env
DATABASE_URL=postgresql://glanus:<STRONG_PASSWORD>@glanus_postgres:5432/glanus?schema=public
REDIS_URL=redis://glanus_redis:6379
NEXTAUTH_URL=https://glanus.yourdomain.com
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
CSRF_SECRET=<run: openssl rand -base64 32>
CRON_SECRET=<run: openssl rand -base64 32>
NEXT_PUBLIC_APP_URL=https://glanus.yourdomain.com
NEXT_PUBLIC_API_URL=https://glanus.yourdomain.com/api
NODE_ENV=production
CONTAINER=true
# Stripe (use live keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PERSONAL=price_...
STRIPE_PRICE_TEAM=price_...
STRIPE_PRICE_ENTERPRISE=price_...
NEXT_PUBLIC_STRIPE_PRICE_PERSONAL=price_...
NEXT_PUBLIC_STRIPE_PRICE_TEAM=price_...
# Email (pick one)
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
# Sentry (optional)
SENTRY_DSN=https://...
NEXT_PUBLIC_SENTRY_DSN=https://...
# OpenAI (optional)
OPENAI_API_KEY=sk-...
Resources: Minimum 1 CPU / 1 GB RAM (recommend 2 CPU / 2 GB for production)
Service 2: PostgreSQL (type: Postgres)
Image: postgres:15
Database name: glanus
Username: glanus
Password: Use the same strong password you set in DATABASE_URL above
Volume: EasyPanel auto-creates persistent storage
The internal hostname will be something like glanus_postgres — use this in DATABASE_URL
Service 3: Redis (type: Redis)
Image: redis:7 (default)
No password needed for internal-only access
Internal hostname will be glanus_redis — use this in REDIS_URL
3. Post-Deploy Steps
After the first successful deploy, run the Prisma migration inside the app container:

Go to App service → Terminal tab
Run:
bash
npx prisma migrate deploy
Optionally seed initial data:
bash
npx prisma db seed
4. Auto-Deploy
EasyPanel will auto-deploy on every push to main since you've connected the GitHub repo. The Dockerfile handles everything: npm ci → prisma generate → next build → standalone server.

Key Notes
Internal networking: Services within the same EasyPanel project can reach each other by service name (e.g. glanus_postgres, glanus_redis). Don't expose DB/Redis ports externally.
Health check: Your Dockerfile already has HEALTHCHECK hitting /api/health — EasyPanel will use this.
Logs: Available in EasyPanel's Logs tab per service. Winston logs also write to /app/logs/ inside the container.