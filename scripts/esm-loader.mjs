export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("https://esm.sh/@supabase/supabase-js")) {
    return nextResolve("@supabase/supabase-js", context);
  }
  return nextResolve(specifier, context);
}
