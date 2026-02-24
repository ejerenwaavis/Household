# Production Deployment Guide

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Server Deployment](#server-deployment)
5. [Client Deployment](#client-deployment)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests pass: `npm test` on both client and server
- [ ] No console warnings or errors
- [ ] No security vulnerabilities: `npm audit --production`
- [ ] ESLint passes on all files
- [ ] Code follows project style guide
- [ ] All TODO comments are addressed

### Functionality Verification
- [ ] QA checklist completed: `QA_CHECKLIST.md`
- [ ] All critical features tested in staging
- [ ] Performance meets requirements (< 2s page load)
- [ ] Date/month calculations are correct
- [ ] Duplicate prevention works
- [ ] Authorization checks enforced
- [ ] Error handling complete

### Security Review
- [ ] All API endpoints require authentication (if sensitive)
- [ ] All inputs are validated (Joi schemas, frontend validation)
- [ ] Passwords meet strength requirements
- [ ] Tokens expire appropriately (15min access, 7d refresh)
- [ ] HTTPS/SSL will be enforced
- [ ] CORS is configured for correct origins
- [ ] No sensitive data logged
- [ ] Rate limiting configured
- [ ] Security headers present

---

## Environment Configuration

### Create `.env.production` on Server

```bash
# Server Configuration
NODE_ENV=production
PORT=3000
API_URL=https://api.yourdomain.com

# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/household-prod?retryWrites=true&w=majority
MONGODB_POOL_SIZE=10

# Authentication
JWT_SECRET=YOUR_VERY_SECURE_JWT_SECRET_KEY_MIN_32_CHARS
JWT_EXPIRES_IN=900  # 15 minutes in seconds
JWT_REFRESH_EXPIRES_IN=604800  # 7 days in seconds

# Email Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxx
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Household Finance

# Sentry Error Tracking
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
SENTRY_TRACE_SAMPLE_RATE=0.1

# CORS Configuration
PRODUCTION_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### Create `.env.production` on Client

```bash
# Client Configuration
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_APP_NAME=Household Finance Manager
REACT_APP_VERSION=1.0.0

# Sentry Configuration
REACT_APP_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
REACT_APP_SENTRY_ENVIRONMENT=production

# Feature Flags
REACT_APP_OFFLINE_MODE=false
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_DEFAULT_LANGUAGE=en
```

---

## Database Setup

### MongoDB Atlas Setup (Cloud)

1. **Create Cluster**
   - Go to mongodb.com/cloud/atlas
   - Create new organization and cluster
   - Choose AWS region close to your servers
   - Select M0 (free) or M1 (paid) tier

2. **Create Database User**
   - Navigate to "Database Access"
   - Create user with strong password
   - Select "Read and write to any database"

3. **Whitelist IP Addresses**
   - Navigate to "Network Access"
   - Add your server IP address (or 0.0.0.0/0 for development)
   - For production, use specific server IPs only

4. **Get Connection String**
   - Click "Connect" on cluster
   - Select "Connect your application"
   - Copy connection string with password
   - Update `.env.production` with connection URI

### Database Initialization

```bash
# SSH into server
ssh user@server-ip

# Navigate to server directory
cd /opt/household-api

# Install dependencies
npm install --production

# Run database migrations if needed
npm run migrate

# Create indexes
npm run db:seed  # Optional: add sample data for testing
```

---

## Server Deployment

### Using PM2 (Recommended for Node.js)

1. **Install PM2**
   ```bash
   npm install -g pm2
   ```

2. **Create PM2 Ecosystem File** (`ecosystem.config.js`)
   ```javascript
   module.exports = {
     apps: [{
       name: 'household-api',
       script: './src/index.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       error_file: './logs/pm2-error.log',
       out_file: './logs/pm2-output.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
       merge_logs: true,
       max_memory_restart: '500M'
     }]
   };
   ```

3. **Start Application**
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. **Monitor**
   ```bash
   pm2 monit          # Real-time monitoring
   pm2 logs            # View logs
   pm2 status          # Check status
   ```

### Using Docker (Alternative)

1. **Build Docker Image**
   ```bash
   docker build -t household-api:1.0.0 .
   ```

2. **Run Container**
   ```bash
   docker run -d \
     -p 3000:3000 \
     --env-file .env.production \
     --name household-api \
     --restart unless-stopped \
     household-api:1.0.0
   ```

### Using Heroku

1. **Create Heroku App**
   ```bash
   heroku create household-api
   ```

2. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET=your_secret
   # ... set all other env vars
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

---

## Client Deployment

### Build Production Bundle

```bash
cd client
npm install --production
npm run build
```

### Deploy to Netlify (Recommended)

1. **Connect Repository**
   - Log in to netlify.com
   - Click "New site from Git"
   - Select your git provider and repository

2. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Build command: `npm run build`

3. **Set Environment Variables**
   - Go to "Site settings → Build & deploy → Environment"
   - Add all variables from `.env.production`

4. **Enable Automatic Deployment**
   - Any push to main branch will auto-deploy

### Deploy to AWS S3 + CloudFront

1. **Build Application**
   ```bash
   npm run build
   ```

2. **Upload to S3**
   ```bash
   aws s3 sync dist/ s3://your-bucket-name
   ```

3. **Invalidate CloudFront Cache**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id YOUR_DIST_ID \
     --paths "/*"
   ```

### Deploy to Traditional Server (nginx)

1. **Build Application**
   ```bash
   npm run build
   ```

2. **Copy to Server**
   ```bash
   scp -r dist/* user@server:/var/www/household-app/
   ```

3. **Configure nginx**
   ```nginx
   server {
     listen 80;
     server_name yourdomain.com;
     root /var/www/household-app;
     
     location / {
       try_files $uri $uri/ /index.html;
     }
     
     location /api/ {
       proxy_pass http://localhost:3000/api/;
     }
   }
   ```

4. **Enable SSL (Let's Encrypt)**
   ```bash
   certbot --nginx -d yourdomain.com
   ```

---

## Post-Deployment Verification

### Health Checks

```bash
# Check API is responding
curl https://api.yourdomain.com/api/health

# Check database connection
curl https://api.yourdomain.com/api/db-status

# Check Sentry integration
curl -X POST https://api.yourdomain.com/api/test-sentry
```

### Functionality Testing

- [ ] User can register
- [ ] User can login
- [ ] User can create household
- [ ] User can add credit card
- [ ] User can create statement
- [ ] Date calculations are correct
- [ ] Month display shows correct month
- [ ] Duplicate prevention works
- [ ] Validation errors show correctly
- [ ] Forms submit successfully

### Performance Checks

```bash
# Check page load time
ab -n 100 -c 10 https://api.yourdomain.com/api/health

# Check error rate (should be < 0.1%)
# Monitor in Sentry dashboard
```

### Security Verification

```bash
# Check HTTPS is enforced
curl -I https://yourdomain.com

# Check security headers
curl -I https://yourdomain.com | grep -i "Content-Security-Policy\|X-Frame-Options\|HSTS"

# Test rate limiting
for i in {1..150}; do curl https://api.yourdomain.com/api/login; done
# Should receive 429 after 100+ requests
```

---

## Monitoring & Maintenance

### Set Up Monitoring

1. **Sentry Dashboard**
   - Monitor at sentry.io
   - Create alerts for critical errors
   - Configure team notifications

2. **PM2 Plus** (Optional)
   ```bash
   pm2 plus
   ```

3. **Database Monitoring**
   - MongoDB Atlas dashboard
   - Monitor storage usage, connections, operations

4. **Uptime Monitoring**
   - Use UptimeRobot.com or similar
   - Configure alerts for downtime

### Regular Backups

```bash
# Backup MongoDB
mongodump --uri "YOUR_CONNECTION_STRING" --out /backups/household-$(date +%Y%m%d)

# Backup S3 (if using)
aws s3 sync s3://your-bucket /local/backup

# Schedule with cron
0 2 * * * /home/ubuntu/backup-db.sh
```

### Regular Updates

```bash
# Update npm packages (test thoroughly first)
npm update

# Check for security vulnerabilities
npm audit fix

# Update Node.js runtime
nvm install node
nvm use node
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs household-api

# Check port is not in use
lsof -i :3000

# Test database connection
node -e "const m = require('mongoose'); m.connect(process.env.MONGODB_URI).then(() => console.log('Connected'))"
```

### High Memory Usage

```bash
# Monitor memory
pm2 monit

# Increase restart threshold
pm2 update household-api --max-memory-restart 1G
```

### Database Connection Issues

- Verify IP whitelist in MongoDB Atlas
- Check connection string format
- Ensure database user has correct permissions
- Verify network connectivity

### SSL Certificate Issues

```bash
# Renew Let's Encrypt certificate
certbot renew

# Check certificate expiry
openssl s_client -connect yourdomain.com:443 -showcerts | grep "Verify return code"
```

### API Not Responding

```bash
# Check if service is running
pm2 status

# Restart if needed
pm2 restart household-api

# Check logs
tail -f logs/combined.log
```

---

## Rollback Procedure

If issues occur in production:

```bash
# Revert to previous version
git checkout previous-version

# Rebuild
npm run build

# Restart services
pm2 restart household-api
pm2 restart household-client
```

---

**Last Updated:** February 24, 2026  
**Maintained By:** Development Team  
**Next Review Date:** March 24, 2026
