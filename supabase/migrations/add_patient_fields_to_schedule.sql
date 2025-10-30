-- Migration: Add patient_name and procedure to schedule table
-- Date: 2025-10-30
-- Purpose: Store patient info directly in schedule for persistence independent of backlog

BEGIN;

-- Check if columns already exist, if not add them
ALTER TABLE public.schedule 
  ADD COLUMN IF NOT EXISTS patient_name text;

ALTER TABLE public.schedule 
  ADD COLUMN IF NOT EXISTS procedure text;

-- Make waiting_list_item_id nullable to allow schedule entries without backlog link
ALTER TABLE public.schedule 
  ALTER COLUMN waiting_list_item_id DROP NOT NULL;

-- Update foreign key constraint to SET NULL on delete
ALTER TABLE public.schedule 
  DROP CONSTRAINT IF EXISTS schedule_waiting_list_item_id_fkey;

ALTER TABLE public.schedule 
  ADD CONSTRAINT schedule_waiting_list_item_id_fkey 
    FOREIGN KEY (waiting_list_item_id) 
    REFERENCES backlog(id) 
    ON DELETE SET NULL;

-- Backfill existing entries with patient data from linked backlog items
UPDATE public.schedule s
SET 
  patient_name = b.patient_name,
  procedure = b.procedure
FROM public.backlog b
WHERE s.waiting_list_item_id = b.id
  AND s.patient_name IS NULL
  AND b.patient_name IS NOT NULL;

COMMIT;
