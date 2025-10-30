# Supabase Migration Required: Add Patient Fields to Schedule

## Issue
Patient names are showing as "Patient" in the schedule because the database is missing the `patient_name` and `procedure` columns in the `schedule` table.

## Solution
You need to run the SQL migration to add these columns to your Supabase database.

### How to Run the Migration

1. **Go to Supabase Dashboard**
   - Open https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and paste the SQL from** `supabase/migrations/add_patient_fields_to_schedule.sql`

4. **Click "Run"** (or Cmd+Enter)

### What the Migration Does

✅ Adds `patient_name` text column to schedule table  
✅ Adds `procedure` text column to schedule table  
✅ Makes `waiting_list_item_id` nullable  
✅ Updates foreign key constraint to `ON DELETE SET NULL`  
✅ Backfills existing schedule entries with patient data from backlog  

### After Running the Migration

1. Create a new schedule entry
2. Open browser DevTools Console (F12)
3. Mark the entry as "operated"
4. Patient name should now persist! ✅

## If You Still See "Patient" After Running Migration

Check the console logs (F12 → Console tab):
- Look for `[createSchedule] inserting:` - should show `patient_name` value
- Look for `[createSchedule] inserted data:` - should show data was returned
- Check for any error messages

The patient names will only work for **new schedule entries created after the migration**.

For existing entries without patient names, you can manually update them or they'll be backfilled if they have linked backlog items.
