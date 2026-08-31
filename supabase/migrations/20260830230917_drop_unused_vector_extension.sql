-- The learner-facing RAG subsystem was the final consumer of pgvector.
-- DROP EXTENSION intentionally omits CASCADE: PostgreSQL must abort if any
-- application object has acquired a dependency since the retirement audit.
DROP EXTENSION IF EXISTS vector;

DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'LEARNER_AI_EDGE_CLEANUP_ABORTED: vector extension still installed';
  END IF;
END;
$verify$;
