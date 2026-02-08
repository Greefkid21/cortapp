
-- Run this in your Supabase SQL Editor to add the 'seed' column to the players table
-- This is required for the strict scheduler to work with seeded fairness
ALTER TABLE public.players ADD COLUMN seed INTEGER;
