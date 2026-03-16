import { supabase } from './supabase';

/**
 * Upload a file to Supabase Storage and save metadata to data_files table.
 */
export const uploadDataFile = async (userId, file, columnMapping = {}, rowCount = 0) => {
  const ext = file.name.split('.').pop();
  const storagePath = `${userId}/${Date.now()}_${file.name}`;

  // Upload to Supabase Storage
  const { error: storageError } = await supabase.storage
    .from('data-files')
    .upload(storagePath, file, { upsert: false });

  if (storageError) throw storageError;

  // Save metadata to data_files table
  const { data, error: dbError } = await supabase.from('data_files').insert({
    user_id: userId,
    file_name: file.name,
    file_size: file.size,
    file_type: ext,
    storage_path: storagePath,
    row_count: rowCount,
    status: 'ready',
    column_mapping: columnMapping,
  }).select().single();

  if (dbError) throw dbError;
  return data;
};

/**
 * Fetch all data files for the current user.
 */
export const fetchDataFiles = async (userId) => {
  const { data, error } = await supabase
    .from('data_files')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Delete a file from Storage and remove its metadata row.
 */
export const deleteDataFile = async (fileId, storagePath) => {
  if (storagePath) {
    await supabase.storage.from('data-files').remove([storagePath]);
  }
  const { error } = await supabase.from('data_files').delete().eq('id', fileId);
  if (error) throw error;
};

/**
 * Get a temporary signed URL to download/preview a file.
 */
export const getFileDownloadUrl = async (storagePath) => {
  const { data, error } = await supabase.storage
    .from('data-files')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour
  if (error) throw error;
  return data.signedUrl;
};
