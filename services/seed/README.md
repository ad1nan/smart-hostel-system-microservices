# Database Seeding and Device Management

This directory contains scripts to manage the Smart Hostel System database, particularly for ensuring all rooms have proper device assignments.

## Available Scripts

### 1. `seed.js`
Initial database seeding script that creates:
- 24 rooms (8 rooms × 3 floors)
- 120 devices (5 devices per room)
- 14 days of energy usage history
- Energy reports

**Usage:**
```bash
# With Docker Compose
docker-compose --profile seed up seed

# Direct execution (requires MongoDB connection)
MONGO_URI=mongodb://localhost:27018/hostelDB node seed.js
```

### 2. `check-devices.js`
Diagnostic script to check current device distribution across rooms.

**Usage:**
```bash
# With Docker Compose
docker-compose --profile check up check-devices

# Direct execution
MONGO_URI=mongodb://localhost:27018/hostelDB node check-devices.js
```

**Output:**
- Shows device count for each room
- Identifies rooms with missing devices
- Provides summary statistics

### 3. `fix-devices.js`
Fix script to ensure all rooms have exactly 5 devices each.

**Usage:**
```bash
# With Docker Compose
docker-compose --profile fix up fix-devices

# Direct execution
MONGO_URI=mongodb://localhost:27018/hostelDB node fix-devices.js
```

**What it does:**
- Identifies rooms with fewer than 5 devices
- Creates missing devices with appropriate types
- Avoids duplicate device types in each room
- Adds extra devices if needed to reach 5 per room

## Device Types per Room

Each room should have these 5 device types:
1. **Light** (24W) - Ceiling Light
2. **Fan** (75W) - Ceiling Fan  
3. **AC** (1300W) - AC Unit
4. **Heater** (1000W) - Wall Heater
5. **Desk Plug** (120W) - Study Plug

## Troubleshooting Device Issues

### Problem: Only some rooms show devices in the frontend

**Symptoms:**
- Dashboard shows 50 total devices instead of 120
- Only 10 rooms have devices, others show empty
- Floor planner shows empty rooms

**Solution:**
1. First, check the current state:
   ```bash
   docker-compose --profile check up check-devices
   ```

2. If rooms are missing devices, run the fix:
   ```bash
   docker-compose --profile fix up fix-devices
   ```

3. Verify the fix worked:
   ```bash
   docker-compose --profile check up check-devices
   ```

### Problem: Device counts don't match expectations

**Expected:**
- 24 rooms × 5 devices = 120 total devices

**If you see fewer devices:**
- Run `fix-devices.js` to add missing devices
- Check for any database connection issues

## Environment Variables

- `MONGO_URI`: MongoDB connection string
  - Default: `mongodb://mongo:27017/hostelDB`
  - Local development: `mongodb://localhost:27018/hostelDB`

## Notes

- All scripts are non-destructive except `seed.js` which clears existing data
- `fix-devices.js` only adds devices, never removes existing ones
- Device status is randomized (70% enabled for normal devices, 20% for heaters)
- Scripts include proper error handling and logging
