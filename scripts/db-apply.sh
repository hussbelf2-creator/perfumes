#!/usr/bin/env bash
# يطبّق supabase/schema.sql على قاعدة Supabase (آمن لإعادة التشغيل).
# الاستخدام: SUPABASE_DB_URL="postgresql://postgres:<كلمة المرور>@db.<المشروع>.supabase.co:5432/postgres" npm run db:apply
# الرابط من: Supabase ← Project Settings ← Database ← Connection string (URI). لا تحفظه في المستودع.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL غير مضبوط. راجع التعليق أعلى هذا الملف." >&2
  exit 1
fi
command -v psql >/dev/null || { echo "يلزم psql (PostgreSQL client)." >&2; exit 1; }
PGOPTIONS="-c client_min_messages=warning" psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/schema.sql
echo "✓ طُبّق المخطط. الخطوة التالية: npm run check:backend"
