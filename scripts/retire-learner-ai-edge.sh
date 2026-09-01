#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"

retired_functions=(
  ai-tutor
  embed-lesson
  generate-flashcards
  generate-learning-path
  generate-lesson-summary
)
required_functions=(corelia-api generate-description generate-questions)
retired_secrets=(
  CORELIA_AI_PROVIDER
  ANTHROPIC_API_KEY
  CORELIA_ANTHROPIC_DEFAULT_MODEL
  CORELIA_ANTHROPIC_COMPLEX_MODEL
  CORELIA_OPENAI_DEFAULT_MODEL
  CORELIA_OPENAI_COMPLEX_MODEL
  CORELIA_SUPABASE_URL
  CORELIA_SUPABASE_SECRET_KEYS
)

function_inventory="$(supabase functions list --project-ref "$SUPABASE_PROJECT_REF" --output json)"
for function_name in "${retired_functions[@]}"; do
  if jq --exit-status --arg slug "$function_name" 'any(.[]; .slug == $slug)' \
    <<<"$function_inventory" >/dev/null; then
    supabase functions delete "$function_name" --project-ref "$SUPABASE_PROJECT_REF" --yes
  fi
done

secret_inventory="$(supabase secrets list --project-ref "$SUPABASE_PROJECT_REF" --output json)"
secrets_to_unset=()
for secret_name in "${retired_secrets[@]}"; do
  if jq --exit-status --arg name "$secret_name" 'any(.[]; .name == $name)' \
    <<<"$secret_inventory" >/dev/null; then
    secrets_to_unset+=("$secret_name")
  fi
done
if ((${#secrets_to_unset[@]} > 0)); then
  supabase secrets unset "${secrets_to_unset[@]}" --project-ref "$SUPABASE_PROJECT_REF" --yes
fi

function_inventory="$(supabase functions list --project-ref "$SUPABASE_PROJECT_REF" --output json)"
for function_name in "${retired_functions[@]}"; do
  jq --exit-status --arg slug "$function_name" 'all(.[]; .slug != $slug)' \
    <<<"$function_inventory" >/dev/null
done
for function_name in "${required_functions[@]}"; do
  jq --exit-status --arg slug "$function_name" \
    'any(.[]; .slug == $slug and .status == "ACTIVE")' \
    <<<"$function_inventory" >/dev/null
done

secret_inventory="$(supabase secrets list --project-ref "$SUPABASE_PROJECT_REF" --output json)"
for secret_name in "${retired_secrets[@]}"; do
  jq --exit-status --arg name "$secret_name" 'all(.[]; .name != $name)' \
    <<<"$secret_inventory" >/dev/null
done

echo "Learner-facing AI Edge functions and unused secrets are absent; retained functions are active."
