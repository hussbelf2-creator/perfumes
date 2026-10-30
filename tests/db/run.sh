#!/usr/bin/env bash
# اختبارات قاعدة البيانات: يطبّق supabase/schema.sql على قاعدة فارغة (مع محاكاة auth وأدوار Supabase)
# ثم يشغّل test.sql. يحتاج PostgreSQL 16+ ومستخدماً مشرفاً، والاتصال من متغيرات libpq:
#   PGHOST PGPORT PGUSER PGPASSWORD   (مثال محلي: PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres)
set -euo pipefail
cd "$(dirname "$0")"
DB="${PP_TEST_DB:-pp_test}"

psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
apply() { local log; log="$(psql -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -d "$DB" "$@" 2>&1)" || { grep -E 'ERROR' <<<"$log" | head -5; return 1; }; }
apply -f shim.sql -f ../../supabase/schema.sql -f grants.sql || { echo "FAIL schema.sql does not apply"; exit 1; }
# المخطط يُطبَّق مرتين في الإنتاج (كل تحديث): يجب أن يبقى قابلاً لإعادة التطبيق
apply -f ../../supabase/schema.sql || { echo "FAIL schema.sql is not re-runnable"; exit 1; }

set +e
out="$(psql -q -t -v ON_ERROR_STOP=1 -d "$DB" -f test.sql 2>&1)"
code=$?
set -e
results="$(grep -oE '(PASS|FAIL).*' <<<"$out" || true)"
pass="$(grep -c '^PASS' <<<"$results" || true)"
fail="$(grep -c '^FAIL' <<<"$results" || true)"
grep '^FAIL' <<<"$results" || true
if [ "$code" -ne 0 ]; then
  echo "$out" | grep -E 'ERROR|psql:' | head -5
  echo "test.sql stopped on an error"
  exit 1
fi
echo "db: $pass passed, $fail failed"
[ "$fail" -eq 0 ] && [ "$pass" -gt 0 ]
