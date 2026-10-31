-- Schema stand-ins ONLY for isolated GitHub Actions PostgreSQL 16.
-- All quote, order, outcome and learning-context functions use actual repo
-- migration files; no live database or fabricated production receipts.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create table auth.users(id uuid primary key);
