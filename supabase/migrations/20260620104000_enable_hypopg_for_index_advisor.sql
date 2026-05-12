-- Ensure HypoPG exists because extensions.index_advisor calls hypopg_reset().
-- This resolves lint/runtime errors when the extension function is present
-- but HypoPG has not been enabled in the project yet.
CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;
