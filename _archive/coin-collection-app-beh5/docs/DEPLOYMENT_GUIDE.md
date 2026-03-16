# Coin Collection Manager - Deployment Guide

## Overview

This guide covers the complete deployment process for the Coin Collection Manager application, including frontend, backend, database setup, and production configuration.

## Prerequisites

Before deploying, ensure you have:

- Node.js 18+ installed
- Git repository access
- Vercel account
- Supabase account
- Domain name (optional)
- SSL certificate (handled by Vercel)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Vercel)      │────│   (Vercel)      │────│   (Supabase)    │
│   React/Next.js │    │   Node.js       │    │   PostgreSQL    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   File Storage  │              │
         └──────────────│   (Supabase)    │──────────────┘
                        │   S3 Compatible │
                        └─────────────────┘
```

## 1. Environment Setup

### 1.1 Clone Repository

```bash
git clone https://github.com/your-username/coin-collection-app.git
cd coin-collection-app
```

### 1.2 Install Dependencies

```bash
# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../backend
npm install

# Return to root
cd ..
```

## 2. Supabase Database Setup

### 2.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose organization and enter project details:
   - **Name**: `coin-collection-prod`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your users
4. Wait for project creation (2-3 minutes)

### 2.2 Configure Database

1. **Get Connection Details**:
   ```
   Project URL: https://your-project.supabase.co
   API Key (anon): your-anon-key
   API Key (service_role): your-service-role-key
   Database URL: postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
   ```

2. **Run Migrations**:
   ```bash
   # Install Supabase CLI
   npm install -g @supabase/cli
   
   # Login to Supabase
   supabase login
   
   # Link to your project
   supabase link --project-ref your-project-ref
   
   # Run migrations
   supabase db push
   
   # Seed initial data
   supabase db reset --linked
   ```

3. **Configure Row Level Security (RLS)**:
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
   ALTER TABLE coins ENABLE ROW LEVEL SECURITY;
   -- ... (continue for all tables)
   
   -- Create policies (already included in migration)
   ```

### 2.3 Setup Storage

1. **Create Storage Buckets**:
   ```sql
   -- Create coin images bucket
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('coin-images', 'coin-images', true);
   
   -- Create user avatars bucket
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('avatars', 'avatars', true);
   
   -- Create backups bucket (private)
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('backups', 'backups', false);
   ```

2. **Configure Storage Policies**:
   ```sql
   -- Allow authenticated users to upload images
   CREATE POLICY "Users can upload coin images" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'coin-images' AND 
     auth.role() = 'authenticated'
   );
   
   -- Allow users to view public images
   CREATE POLICY "Anyone can view coin images" ON storage.objects
   FOR SELECT USING (bucket_id = 'coin-images');
   ```

## 3. Environment Variables

### 3.1 Create Environment Files

Create `.env.local` files for both frontend and backend:

**Frontend (.env.local)**:
```env
# Application
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# PWA
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Feature Flags
NEXT_PUBLIC_ENABLE_AI_RECOGNITION=true
NEXT_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true
```

**Backend (.env)**:
```env
# Application
NODE_ENV=production
PORT=3001
APP_VERSION=1.0.0

# Database
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
ENCRYPTION_KEY=your-32-char-encryption-key

# External APIs
COINAPI_KEY=your-coinapi-key
GOOGLE_VISION_API_KEY=your-google-vision-key

# Monitoring
SENTRY_DSN=your-sentry-dsn
DATADOG_API_KEY=your-datadog-key

# Email
SENDGRID_API_KEY=your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@your-domain.com

# Push Notifications
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:your-email@domain.com
```

### 3.2 Secure Environment Variables

**Never commit sensitive environment variables to version control!**

Use Vercel's environment variable management:

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Add environment variables
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add JWT_SECRET production
vercel env add ENCRYPTION_KEY production
# ... continue for all sensitive variables
```

## 4. Vercel Deployment

### 4.1 Configure Vercel Project

1. **Create vercel.json** (already created in project root):
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "frontend/package.json",
         "use": "@vercel/next"
       },
       {
         "src": "backend/package.json",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "backend/index.js"
       },
       {
         "src": "/(.*)",
         "dest": "frontend/$1"
       }
     ]
   }
   ```

2. **Deploy to Vercel**:
   ```bash
   # From project root
   vercel --prod
   
   # Or connect GitHub repository for automatic deployments
   vercel --prod --github
   ```

### 4.2 Configure Custom Domain

1. **Add Domain in Vercel Dashboard**:
   - Go to Project Settings → Domains
   - Add your custom domain
   - Configure DNS records as instructed

2. **DNS Configuration**:
   ```
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   
   Type: A
   Name: @
   Value: 76.76.19.61
   ```

### 4.3 Configure Redirects

Add to `vercel.json`:
```json
{
  "redirects": [
    {
      "source": "/app",
      "destination": "/",
      "permanent": true
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://your-domain.com"
        }
      ]
    }
  ]
}
```

## 5. CI/CD Pipeline Setup

### 5.1 GitHub Actions Configuration

The CI/CD pipeline is already configured in `.github/workflows/`. Ensure these secrets are set in your GitHub repository:

**Repository Secrets**:
```
VERCEL_TOKEN=your-vercel-token
VERCEL_ORG_ID=your-vercel-org-id
VERCEL_PROJECT_ID=your-vercel-project-id
SUPABASE_ACCESS_TOKEN=your-supabase-access-token
SUPABASE_PROJECT_ID=your-supabase-project-id
SENTRY_AUTH_TOKEN=your-sentry-auth-token
```

### 5.2 Deployment Workflow

1. **Development**:
   ```bash
   git checkout develop
   git add .
   git commit -m "feat: new feature"
   git push origin develop
   ```
   → Triggers staging deployment

2. **Production**:
   ```bash
   git checkout main
   git merge develop
   git tag v1.0.0
   git push origin main --tags
   ```
   → Triggers production deployment

## 6. Monitoring Setup

### 6.1 Error Tracking (Sentry)

1. **Create Sentry Project**:
   - Go to [Sentry.io](https://sentry.io)
   - Create new project for React and Node.js
   - Get DSN keys

2. **Configure Sentry**:
   ```bash
   # Install Sentry CLI
   npm install -g @sentry/cli
   
   # Login and configure
   sentry-cli login
   sentry-cli releases new v1.0.0
   sentry-cli releases files v1.0.0 upload-sourcemaps ./frontend/.next
   ```

### 6.2 Analytics (Google Analytics)

1. **Create GA4 Property**:
   - Go to [Google Analytics](https://analytics.google.com)
   - Create new GA4 property
   - Get Measurement ID

2. **Configure Tracking**:
   ```javascript
   // Already configured in frontend/src/lib/analytics.js
   ```

### 6.3 Performance Monitoring

1. **Lighthouse CI**:
   ```bash
   # Install Lighthouse CI
   npm install -g @lhci/cli
   
   # Run performance audit
   lhci autorun
   ```

2. **Uptime Monitoring**:
   - Use services like Pingdom, UptimeRobot, or StatusCake
   - Monitor endpoints:
     - `https://your-domain.com`
     - `https://your-domain.com/api/health`

## 7. Security Configuration

### 7.1 SSL/TLS Setup

Vercel automatically provides SSL certificates. Verify:
```bash
curl -I https://your-domain.com
# Should return: strict-transport-security header
```

### 7.2 Security Headers

Configure in `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### 7.3 Rate Limiting

Configure Vercel Edge Config:
```bash
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
```

## 8. Backup Strategy

### 8.1 Database Backups

1. **Automated Supabase Backups**:
   - Supabase Pro plan includes daily backups
   - Configure backup retention period

2. **Custom Backup Script**:
   ```bash
   #!/bin/bash
   # backup.sh
   
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_FILE="backup_${DATE}.sql"
   
   pg_dump $DATABASE_URL > $BACKUP_FILE
   
   # Upload to cloud storage
   aws s3 cp $BACKUP_FILE s3://your-backup-bucket/
   ```

### 8.2 File Storage Backups

```bash
# Sync Supabase storage to backup location
supabase storage cp --recursive supabase://coin-images ./backups/images/
```

## 9. Performance Optimization

### 9.1 Frontend Optimization

1. **Next.js Configuration**:
   ```javascript
   // next.config.js
   module.exports = {
     images: {
       domains: ['your-project.supabase.co'],
       formats: ['image/webp', 'image/avif'],
     },
     compress: true,
     poweredByHeader: false,
   }
   ```

2. **Bundle Analysis**:
   ```bash
   npm run analyze
   ```

### 9.2 Database Optimization

1. **Indexes**:
   ```sql
   -- Already included in migrations
   CREATE INDEX idx_coins_collection_id ON coins(collection_id);
   CREATE INDEX idx_coins_country_year ON coins(country_id, year);
   ```

2. **Connection Pooling**:
   ```javascript
   // Already configured in backend/config/database.js
   ```

## 10. Testing in Production

### 10.1 Smoke Tests

```bash
# Test critical endpoints
curl https://your-domain.com/api/health
curl https://your-domain.com/api/countries
```

### 10.2 Load Testing

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

**load-test.yml**:
```yaml
config:
  target: 'https://your-domain.com'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "API Load Test"
    requests:
      - get:
          url: "/api/health"
      - get:
          url: "/api/countries"
```

## 11. Maintenance

### 11.1 Regular Updates

```bash
# Update dependencies monthly
npm update
npm audit fix

# Update Supabase CLI
npm update -g @supabase/cli

# Update Vercel CLI
npm update -g vercel
```

### 11.2 Log Monitoring

```bash
# View Vercel logs
vercel logs --follow

# View Supabase logs
supabase logs --follow
```

### 11.3 Database Maintenance

```sql
-- Monthly maintenance
VACUUM ANALYZE;
REINDEX DATABASE postgres;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 12. Troubleshooting

### 12.1 Common Issues

**Build Failures**:
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

**Database Connection Issues**:
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

**Environment Variable Issues**:
```bash
# Verify variables are set
vercel env ls
```

### 12.2 Rollback Procedure

```bash
# Rollback to previous deployment
vercel rollback

# Or rollback to specific deployment
vercel rollback https://your-app-abc123.vercel.app
```

### 12.3 Emergency Contacts

- **Vercel Support**: support@vercel.com
- **Supabase Support**: support@supabase.com
- **On-call Engineer**: your-email@domain.com

## 13. Post-Deployment Checklist

- [ ] Application loads successfully
- [ ] User registration/login works
- [ ] Database connections are stable
- [ ] File uploads work correctly
- [ ] PWA installation works
- [ ] Push notifications work
- [ ] All API endpoints respond correctly
- [ ] SSL certificate is valid
- [ ] Monitoring is active
- [ ] Backups are configured
- [ ] Error tracking is working
- [ ] Performance metrics are being collected
- [ ] Security headers are set
- [ ] Rate limiting is active
- [ ] Domain redirects work
- [ ] SEO meta tags are correct

## 14. Scaling Considerations

### 14.1 Database Scaling

- Monitor connection pool usage
- Consider read replicas for heavy read workloads
- Implement database sharding if needed
- Use connection pooling (PgBouncer)

### 14.2 Application Scaling

- Vercel automatically scales serverless functions
- Monitor function execution time and memory usage
- Consider edge caching for static content
- Implement CDN for global content delivery

### 14.3 Storage Scaling

- Monitor storage usage and costs
- Implement image optimization and compression
- Consider multiple storage providers for redundancy
- Set up automated cleanup for old files

## Support

For deployment support:
- **Documentation**: https://your-domain.com/docs
- **Email**: devops@your-domain.com
- **Slack**: #deployment-support
- **Emergency**: +1-XXX-XXX-XXXX