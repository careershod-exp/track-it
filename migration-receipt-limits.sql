-- Receipt upload limits (Finding 4)
--
-- The receipts bucket was created with no file_size_limit or
-- allowed_mime_types, so nothing on the server side stopped an oversized
-- or non-image file from being uploaded -- the app's own file picker
-- (accept="image/*") is a UX hint only, not a real restriction. This
-- sets real limits on the bucket itself, matching the client-side check
-- added to store.js's uploadReceipt().

update storage.buckets
set file_size_limit = 5242880, -- 5MB, in bytes
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'receipts';
