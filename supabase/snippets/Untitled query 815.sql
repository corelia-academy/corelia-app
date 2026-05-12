select column_name
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;

select * from information_schema.tables
where table_schema='public' and table_name='public_profiles';
