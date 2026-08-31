# Admin Configuration Page - Walkthrough Guide

**BeZhas Platform** | Admin Guide | Version 1.0

---

## Introduction

The Admin Configuration Page provides a centralized interface for managing all platform-wide settings. Changes made here persist in the database and are automatically reflected across the platform.

---

## Accessing the Configuration Page

### Step 1: Admin Login
1. Navigate to `/admin-login`
2. Enter your admin credentials
3. Click "Login" to authenticate

### Step 2: Navigate to Configuration
1. From the Admin Dashboard, click on **Settings** in the sidebar
2. Select **Platform Configuration**
3. Or navigate directly to `/admin/config`

---

## Configuration Sections

### 1. DeFi / Exchange Settings

![DeFi Section](docs/images/defi-section.png)

**Available Options:**
| Setting | Description | Default |
|---------|-------------|---------|
| Enable DeFi | Toggle DeFi features | ON |
| Swap Fee % | Fee for token swaps | 0.3% |
| Max Slippage % | Maximum slippage tolerance | 1% |
| Bridge Fee % | Fee for cross-chain bridges | 0.1% |
| Min Swap Amount | Minimum swap in tokens | 1 |
| Max Swap Amount | Maximum swap in tokens | 1,000,000 |

**To Modify:**
1. Expand the "DeFi / Exchange" section
2. Adjust values using input fields or toggles
3. Click "Save Changes" at the top

---

### 2. Fiat Gateway Settings

**Provider Configuration:**
- **Stripe**: Enable/disable, set fee percentage
- **MoonPay**: Enable/disable, set fee percentage
- **Bank Transfer**: Enable/disable, set fee percentage

**Limits:**
| Setting | Description | Default |
|---------|-------------|---------|
| Min Purchase USD | Minimum fiat purchase | $10 |
| Max Purchase USD | Maximum fiat purchase | $10,000 |
| KYC Required | Require identity verification | ON |
| KYC Threshold | KYC required above this amount | $1,000 |

**Supported Currencies:**
Default: USD, EUR, GBP (editable)

---

### 3. BEZ Token Settings

**Contract Information:**
- Contract Address (display only): `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`
- Symbol: BEZ
- Decimals: 18

**Token Rules:**
| Setting | Description | Default |
|---------|-------------|---------|
| Minting Enabled | Allow new token creation | OFF |
| Max Mint Per TX | Maximum tokens per transaction | 10,000 |
| Daily Mint Limit | Maximum tokens minted per day | 100,000 |
| Burning Enabled | Allow token burning | ON |
| Transfer Fee % | Fee on token transfers | 0% |

---

### 4. Farming / Yield Settings

**Pool Configuration:**
| Setting | Description | Default |
|---------|-------------|---------|
| Farming Enabled | Enable farming features | ON |
| Default APY % | Base annual percentage yield | 15% |
| Rewards Per Block | BEZ rewards per block | 1 |
| Harvest Lock Hours | Lock period after harvest | 24h |
| Early Withdrawal Penalty % | Penalty for early exit | 10% |

---

### 5. Staking Settings

**Staking Rules:**
| Setting | Description | Default |
|---------|-------------|---------|
| Staking Enabled | Enable staking features | ON |
| Min Stake Amount | Minimum stake in BEZ | 100 |
| Max Stake Amount | Maximum stake in BEZ | 10,000,000 |
| Reward Rate % | Annual reward percentage | 12% |
| Compounding Enabled | Allow auto-compound | ON |
| Compound Frequency | Hours between compounds | 24h |
| Unstake Cooldown | Hours before unstake | 48h |

**Lock Periods:**
Configure bonus multipliers for different lock durations.

---

### 6. DAO Governance Settings

**Voting Configuration:**
| Setting | Description | Default |
|---------|-------------|---------|
| DAO Enabled | Enable governance features | ON |
| Quorum % | Votes needed for validity | 10% |
| Voting Period Days | Duration of voting | 7 days |
| Proposal Threshold | BEZ needed to propose | 100,000 |
| Execution Delay | Hours after vote passes | 24h |
| Allow Delegation | Enable vote delegation | ON |
| Max Delegations | Max delegates per user | 100 |
| Reward Per Vote | BEZ earned per vote | 10 |

**Veto System:**
| Setting | Description | Default |
|---------|-------------|---------|
| Veto Enabled | Allow council veto | OFF |
| Veto Threshold % | Votes needed to veto | 33% |

---

### 7. RWA (Real World Assets) Settings

**Investment Limits:**
| Setting | Description | Default |
|---------|-------------|---------|
| RWA Enabled | Enable RWA features | ON |
| Min Investment USD | Minimum investment | $100 |
| Max Investment USD | Maximum investment | $1,000,000 |
| Platform Fee % | Fee on investments | 2.5% |
| KYC Required | Require identity verification | ON |
| Accredited Required | Require accreditation | OFF |

**Asset Categories:**
- Real Estate: ON
- Commodities: ON
- Art: OFF
- Collectibles: OFF

**Legal Jurisdictions:**
Default: US, EU, UK (editable)

---

### 8. Platform General Settings

**System Configuration:**
| Setting | Description | Default |
|---------|-------------|---------|
| Maintenance Mode | Disable platform access | OFF |
| Maintenance Message | Message shown during maintenance | (default text) |
| Registration Enabled | Allow new user signups | ON |
| Email Verification | Require email verification | ON |
| Max Login Attempts | Failed logins before lockout | 5 |
| Session Timeout | Minutes until auto-logout | 60 |
| Logging Level | Server log verbosity | info |

---

## Saving Changes

### Save All Changes
1. Modify desired settings across any section
2. Click the **"Save Changes"** button in the header
3. Wait for confirmation toast message
4. Settings are immediately applied

### Undo Changes
1. Click **"Undo"** to revert to last saved state
2. Only affects unsaved changes

### Reset to Defaults
1. Click **"Reset Defaults"** button
2. Confirm the action in the dialog
3. All settings return to factory defaults

---

## Best Practices

### Before Modifying Production Settings
1. ✅ Test changes in staging environment first
2. ✅ Document the current settings before changing
3. ✅ Notify the team of planned changes
4. ✅ Schedule changes during low-traffic periods

### Security Considerations
1. 🔒 Only authorized admins can access this page
2. 🔒 All changes are logged with admin ID
3. 🔒 Sensitive settings require confirmation
4. 🔒 API endpoints require admin token

---

## Troubleshooting

### Settings Not Saving
1. Check network connection
2. Verify admin token is valid
3. Check browser console for errors
4. Try refreshing the page

### Settings Not Reflecting
1. Clear browser cache
2. Hard refresh
3. Check if maintenance mode is enabled
4. Verify backend is running

### 4. GCP Deployment [NEW]
### 4. GCP Deployment [NEW]
### 4. GCP Deployment [NEW]
- **Status:** Failed (Build ID: `2fb2e424-5aa5-4741-ae83-ec32febcdd0c`).
- **Reason:** `ReplyError: ERR max requests limit exceeded` from Redis (Upstash) caused backend startup crash.
- **Status:** In Progress (Build ID: `a6724bd3-3101-4cd9-a6c6-406c46711984`).
- **Action:** Redeploying with Redis connection resilience fix.
- **Fail:** Build `a6724bd3` failed with recurred `pathRegexp` error.
- **Fix:** Updated root `package.json` overrides to pin `path-to-regexp` to `0.1.7` (downgrading from `>=0.1.12`).
- **Action:** Redeploying after fixing Express/path-to-regexp version conflict.
- **Changes:**
  - **Dependency Fix:** Added `path-to-regexp: 0.1.7` to `backend/package.json` to resolve `TypeError: pathRegexp is not a function`.
  - **Crash Fix:** Removed `--gc-interval=100` from `NODE_OPTIONS`.
  - **Port Fix:** Confirmed `PORT=8080` is now correctly set.
  - **Optimization:** Maintaining 2vCPU/2GiB RAM configuration.

## Next Steps
1. Monitor Cloud Build.
2. Verify service startup in Cloud Run logs.

### Access Denied
1. Ensure you're logged in as admin
2. Check admin token expiration
3. Contact system administrator

---

## API Reference

For developers integrating with the settings API:

```bash
# Get all settings
curl -X GET http://localhost:3001/api/admin/settings/global \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Update settings
curl -X PUT http://localhost:3001/api/admin/settings/global \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"platform": {"maintenanceMode": true}}'

# Get specific section
curl -X GET http://localhost:3001/api/admin/settings/global/defi \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Related Documentation

- [Implementation Plan](./implementation_plan.md)
- [Admin Config Implementation](./ADMIN_CONFIG_IMPLEMENTATION.md)
- [API Documentation](/api-docs)
