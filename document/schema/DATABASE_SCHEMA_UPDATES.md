# Database Schema Updates for LockMoment

## Overview
This document outlines the necessary database schema updates to support the new features:
1. Permission status tracking for children
2. Scheduled lock storage from QR generation
3. Permission sync from devices

## Required Tables and Fields

### 1. `devices` Table
**Purpose**: Track device information and permission status

**New/Updated Fields**:
```sql
-- Add permission tracking fields if not already present
ALTER TABLE devices ADD COLUMN IF NOT EXISTS accessibility_permission BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS screen_time_permission BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS notification_permission BOOLEAN DEFAULT FALSE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_permission_sync TIMESTAMP;
```

**Notes**:
- `accessibility_permission`: For Android devices (Accessibility Service)
- `screen_time_permission`: For iOS devices (Screen Time/Family Controls)
- `notification_permission`: For both platforms
- `last_permission_sync`: Timestamp of last permission status update

### 2. `parent_child_relations` Table
**Purpose**: Link parents/teachers with children/students

**Existing Fields** (verify these exist):
```sql
CREATE TABLE IF NOT EXISTS parent_child_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relation_type VARCHAR(20) NOT NULL CHECK (relation_type IN ('PARENT', 'TEACHER')),
    approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(parent_id, child_id)
);
```

### 3. `child_schedules` Table
**Purpose**: Store scheduled locks created by parents for their children

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS child_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days TEXT[] NOT NULL, -- Array of day names: ['월', '화', '수', ...]
    apps TEXT[] NOT NULL, -- Array of app package names/IDs
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure parent has permission to manage this child
    CONSTRAINT fk_parent_child 
        FOREIGN KEY (parent_id, child_id) 
        REFERENCES parent_child_relations(parent_id, child_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_child_schedules_child_id ON child_schedules(child_id);
CREATE INDEX IF NOT EXISTS idx_child_schedules_parent_id ON child_schedules(parent_id);
CREATE INDEX IF NOT EXISTS idx_child_schedules_active ON child_schedules(is_active);
```

### 4. `qr_codes` Table (if not exists)
**Purpose**: Track generated QR codes for audit and expiration

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    qr_id VARCHAR(255) UNIQUE NOT NULL,
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qr_type VARCHAR(50) NOT NULL CHECK (qr_type IN ('USER_INSTANT_LOCK', 'USER_SCHEDULE_LOCK', 'CHILD_REGISTRATION', 'PARENT_LINK')),
    payload JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    used_at TIMESTAMP,
    used_by_device_id UUID REFERENCES devices(id)
);

CREATE INDEX IF NOT EXISTS idx_qr_codes_qr_id ON qr_codes(qr_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_expires_at ON qr_codes(expires_at);
```

## API Endpoints to Implement/Verify

### Permission Sync
```
PATCH /devices/:deviceId/permissions
Body: {
  accessibility?: boolean,
  screenTime?: boolean,
  notification?: boolean
}
```

### Child Schedules
```
GET    /parent-child/:childId/schedules
POST   /parent-child/:childId/schedules
PUT    /parent-child/:childId/schedules/:scheduleId
DELETE /parent-child/:childId/schedules/:scheduleId
```

### Children List with Permissions
```
GET /parent-child/children
Response: {
  success: true,
  data: [
    {
      id: string,
      childName: string,
      deviceName?: string,
      status: 'LOCKED' | 'UNLOCKED' | 'OFFLINE',
      lastSeenAt?: string,
      hasPermission?: boolean  // NEW: Derived from device permissions
    }
  ]
}
```

## Implementation Notes

1. **Permission Status Calculation**:
   - For iOS: `hasPermission = screen_time_permission === true`
   - For Android: `hasPermission = accessibility_permission === true`
   - Unknown/null: Show as grey "미확인" status

2. **Schedule Storage**:
   - When QR is generated with schedule, save to `child_schedules` table
   - Link to specific child or all children based on selection
   - Include all schedule details (time, days, apps)

3. **Permission Sync Flow**:
   - Dashboard checks permissions on load
   - Calls `AuthService.syncPermissions()` to update backend
   - Backend updates `devices` table with permission status
   - Parent queries include JOIN to get child's device permissions

4. **Data Migration**:
   - Run migrations to add new columns to existing tables
   - Set default values for existing records
   - Update API responses to include new fields

## Testing Checklist

- [ ] Verify `devices` table has permission columns
- [ ] Test permission sync from child device to backend
- [ ] Verify parent can see child's permission status
- [ ] Test schedule saving from QR generator
- [ ] Verify schedules appear in child's schedule list
- [ ] Test QR scan permission check and redirect
- [ ] Verify header icon colors change based on permission status
- [ ] Test time picker UI with new layout
