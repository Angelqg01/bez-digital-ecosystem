# 🛠️ Admin Operations Manual

## 🖥️ Admin Panel
**URL**: `/admin` (Locally: `http://localhost:5173/admin` or `5174`)

### Modules
1. **Overview**: Key metrics (User count, TVL, Active Proposals).
2. **User Management**: Ban/Suspend users, Verify profiles (Id check).
3. **Content Moderation**: Review reported posts, overrides AI flags.
4. **AI Hub**: Monitor model training, view usage costs.
5. **System Health**: View error logs, server status, database latency.

---

## 📊 Monitoring & Telemetry
The system uses custom telemetry endpoints.
- **Endpoint**: `/api/telemetry/events`
- **Dashboard**: Grafana (if configured via docker-compose.monitor.yml).

### Daily Checklist
1. Check **System Health** tab for "Red" indicators.
2. Review **Pending Verifications** in User Management.
3. Check **DAO Treasury** balance to ensure funds for operations.

---

## 🔄 DevOps & Maintenance
### Updating the System
1. `git pull origin main`
2. `pnpm install` (Root)
3. `pnpm run build` (Frontend)
4. `pm2 restart all` (Backend - Production)

### Database Backups
MongoDB dumps are automated daily at 00:00 UTC.
- **Location**: `/backups/mongo`
- **Restore**: `mongorestore --db bezhas /backups/mongo/latest`
