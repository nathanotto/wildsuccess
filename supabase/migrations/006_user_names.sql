-- Add full_name and preferred_name to user_profiles

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name     text,
  ADD COLUMN IF NOT EXISTS preferred_name text;

-- Update the new-user trigger to capture name from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, preferred_name)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'preferred_name'
  );
  PERFORM public.seed_default_map_data(new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Set the existing user's name (Nathan Otto)
UPDATE public.user_profiles
SET full_name = 'Nathan Otto', preferred_name = 'Nathan'
WHERE full_name IS NULL;
