# RFT Entertainment - Deployment Guide

This guide will help you deploy the RFT Entertainment backend API to your server.

## Prerequisites

- Node.js 18+ installed on your server
- Supabase project with PostgreSQL database
- Domain name (e.g., your-domain.com)
- SSH access to your server

## Step 1: Set Up Supabase Database

1. Log in to your Supabase dashboard
2. Go to SQL Editor
3. Copy and run the entire content of `backend/database/schema.sql`
4. Verify all tables are created:
   - users
   - tasks
   - user_tasks
   - transactions
   - kyc_documents
   - refresh_tokens

5. Get your Supabase credentials:
   - Project URL (from Settings > API)
   - anon/public key (from Settings > API)
   - service_role key (from Settings > API)
   - Database connection string (from Settings > Database)

## Step 2: Configure Backend

1. Upload the `backend` folder to your server
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

5. Edit `.env` with your actual values:
   ```env
   PORT=3000
   NODE_ENV=production

   # Supabase PostgreSQL
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

   # JWT
   JWT_SECRET=generate-a-very-long-random-secret-key-min-32-characters
   JWT_ACCESS_EXPIRY=15m
   JWT_REFRESH_EXPIRY=30d

   # CORS
   CORS_ORIGIN=https://your-domain.com

   # File Upload
   MAX_FILE_SIZE=5242880
   UPLOAD_DIR=./uploads

   # Business Rules
   PKR_RATE=280
   DAILY_TASK_LIMIT=10
   TASK_REWARD_USDT=0.1
   MIN_RECHARGE_USDT=10
   MAX_RECHARGE_USDT=10000
   MIN_WITHDRAW_USDT=10
   MAX_WITHDRAW_USDT=10000
   ```

6. Create uploads directory:
   ```bash
   mkdir -p uploads
   ```

## Step 3: Test Backend Locally

1. Start the server:
   ```bash
   npm start
   ```

2. Test health endpoint:
   ```bash
   curl http://localhost:3000/api/health
   ```

3. Should return:
   ```json
   {
     "status": "ok",
     "message": "RFT Entertainment API is running",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "environment": "production"
   }
   ```

## Step 4: Install PM2 (Process Manager)

PM2 keeps your Node.js app running forever.

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start the app with PM2:
   ```bash
   pm2 start server.js --name rft-api
   ```

3. Configure PM2 to start on boot:
   ```bash
   pm2 startup
   pm2 save
   ```

4. Useful PM2 commands:
   ```bash
   pm2 list              # List all processes
   pm2 logs rft-api      # View logs
   pm2 restart rft-api   # Restart app
   pm2 stop rft-api      # Stop app
   pm2 delete rft-api    # Delete from PM2
   ```

## Step 5: Configure Nginx Reverse Proxy

Nginx will serve your API and handle SSL.

1. Install Nginx:
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. Create Nginx config file:
   ```bash
   sudo nano /etc/nginx/sites-available/rft-api
   ```

3. Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name api.your-domain.com;

       # Redirect to HTTPS
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name api.your-domain.com;

       # SSL configuration (will be updated by Certbot)
       ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

       # Security headers
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-Content-Type-Options "nosniff" always;
       add_header X-XSS-Protection "1; mode=block" always;

       # File upload size
       client_max_body_size 10M;

       # Proxy to Node.js app
       location /api {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }

       # Serve uploaded files
       location /uploads {
           alias /path/to/backend/uploads;
           expires 30d;
           add_header Cache-Control "public, immutable";
       }
   }
   ```

4. Replace `api.your-domain.com` with your actual API subdomain
5. Replace `/path/to/backend/uploads` with actual path to uploads folder

6. Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/rft-api /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Step 6: Set Up SSL with Let's Encrypt

1. Install Certbot:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. Obtain SSL certificate:
   ```bash
   sudo certbot --nginx -d api.your-domain.com
   ```

3. Follow the prompts to configure SSL

4. Test auto-renewal:
   ```bash
   sudo certbot renew --dry-run
   ```

## Step 7: Configure Firewall

1. Allow necessary ports:
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

## Step 8: Update Frontend API URL

1. Open `js/api-client.js` in your frontend
2. Update the API base URL:
   ```javascript
   const API_CONFIG = {
       baseURL: 'https://api.your-domain.com/api', // Update with your actual API URL
       timeout: 30000
   };
   ```

3. Deploy your updated frontend to your domain

## Step 9: Test the Deployment

1. Test API health:
   ```bash
   curl https://api.your-domain.com/api/health
   ```

2. Test registration:
   ```bash
   curl -X POST https://api.your-domain.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test User","email":"test@example.com","phone":"+923001234567","password":"test123456"}'
   ```

3. Test login:
   ```bash
   curl -X POST https://api.your-domain.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email_or_phone":"test@example.com","password":"test123456"}'
   ```

4. Open your frontend in a browser and test all features

## Step 10: Monitor the Application

1. View PM2 logs:
   ```bash
   pm2 logs rft-api
   ```

2. Monitor server resources:
   ```bash
   htop
   ```

3. Check Nginx logs:
   ```bash
   sudo tail -f /var/log/nginx/access.log
   sudo tail -f /var/log/nginx/error.log
   ```

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use: `sudo lsof -i :3000`
- Check PM2 logs: `pm2 logs rft-api`
- Check .env file has correct values

### Database connection error
- Verify DATABASE_URL is correct
- Check Supabase project is active
- Test connection from server: `psql $DATABASE_URL`

### File upload not working
- Check uploads directory exists and has write permissions
- Check MAX_FILE_SIZE in .env
- Check Nginx client_max_body_size

### CORS errors
- Verify CORS_ORIGIN in .env matches your frontend domain
- Check Nginx headers configuration

### 404 errors
- Check Nginx configuration
- Verify PM2 is running: `pm2 list`
- Check if API is accessible on localhost:3000

## Security Checklist

- [ ] Change JWT_SECRET to a strong random value
- [ ] Use environment variables for all sensitive data
- [ ] Enable SSL/HTTPS
- [ ] Configure firewall
- [ ] Regularly update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Regularly backup database (Supabase has built-in backups)
- [ ] Monitor logs for suspicious activity
- [ ] Keep Node.js dependencies updated: `npm audit fix`

## Maintenance

### Update the application
1. Upload new files to server
2. Restart PM2: `pm2 restart rft-api`
3. Test thoroughly

### Update dependencies
```bash
cd backend
npm update
pm2 restart rft-api
```

### View logs
```bash
pm2 logs rft-api --lines 100
```

## Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs rft-api`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check application logs in the backend directory

## Next Steps

After deployment:
1. Set up regular database backups
2. Configure monitoring (optional)
3. Set up error tracking (optional - e.g., Sentry)
4. Review ADMIN_MANUAL.md for manual approval processes
