-- Multimodal Cora: support image attachments on user messages.
--
-- attachments is an array of objects of shape:
--   { kind: "image", url: <signed URL>, path: <storage path>, mime: <string> }
-- Stored on the user-role row in ai_conversations; assistant rows stay empty.

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage: cora-attachments/{userId}/... — owner-scoped path policy.
CREATE POLICY storage_cora_attachments
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'cora-attachments'
    AND (storage.foldername(name))[2] = (auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'app'
    AND (storage.foldername(name))[1] = 'cora-attachments'
    AND (storage.foldername(name))[2] = (auth.uid()::text)
  );
