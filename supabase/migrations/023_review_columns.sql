-- Add wins and friction text columns to day_reflection
ALTER TABLE public.day_reflection ADD COLUMN IF NOT EXISTS wins text;
ALTER TABLE public.day_reflection ADD COLUMN IF NOT EXISTS friction text;
