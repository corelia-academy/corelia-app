// Build the same production bundle against the disposable API, without inherited remote endpoints.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const raw=execFileSync('pnpm',['exec','supabase','status','--output','env'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
const settings=Object.fromEntries(raw.trim().split('\n').map(line=>{const match=line.match(/^(\w+)="(.*)"$/);assert(match);return [match[1],match[2]];}));
assert(['127.0.0.1','localhost'].includes(new URL(settings.API_URL).hostname));
assert(settings.ANON_KEY);
const env={...process.env,
 VITE_MAINTENANCE_MODE:'false', VITE_HCAPTCHA_SITEKEY:'',
 VITE_SUPABASE_URL:'http://127.0.0.1:54521',VITE_SUPABASE_PUBLISHABLE_KEY:'',VITE_SUPABASE_ANON_KEY:settings.ANON_KEY,
 VITE_CORELIA_FUNCTIONS_URL:'',VITE_CERTIFICATE_ISSUE_API:'',VITE_CDN_BASE_URL:'',
 VITE_GENERATE_DESCRIPTION_FUNCTION_URL:'',VITE_GENERATE_QUESTIONS_FUNCTION_URL:'',
 VITE_YOUTUBE_API_KEY:'',VITE_OCID_CLIENT_ID:'',VITE_OCID_REDIRECT_URI:'',VITE_OCID_SANDBOX:'true',
};
// qa-server-local must already be running: the build's Jobs sitemap uses the same proxy.
const health=await fetch('http://127.0.0.1:54521/rest/v1/',{headers:{apikey:settings.ANON_KEY}});
assert(health.ok,'Start scripts/learning/qa-server-local.mjs before building');
execFileSync('pnpm',['build'],{stdio:'inherit',env});
