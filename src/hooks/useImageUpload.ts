import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { isImageKitEnabled, isImageKitUrl, uploadToImageKit } from '../lib/imagekit';

export const useImageUpload = (folder: string = 'menu-images') => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadImage = async (file: File): Promise<string> => {
    let progressInterval: NodeJS.Timeout | null = null;
    let uploadTimeout: NodeJS.Timeout | null = null;

    try {
      setUploading(true);
      setUploadProgress(0);

      console.log('🚀 Starting upload process...', { fileName: file.name, fileSize: file.size, fileType: file.type });

      // Validate file type - accept ALL image formats
      // Gallery files on mobile often have empty MIME types, so we rely more on file extension
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      // Accept all common image extensions
      const validExtensions = [
        'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif',
        'svg', 'heic', 'heif', 'ico', 'avif', 'jfif'
      ];

      // Check if file extension is valid (primary check for gallery files)
      const hasValidExtension = fileExtension && validExtensions.includes(fileExtension);

      // Check MIME type - accept any image/* type or empty (for mobile gallery files)
      const hasValidMimeType = !file.type || file.type.startsWith('image/');

      // Allow if either extension OR MIME type is valid (gallery files often have empty MIME type)
      if (!hasValidExtension && !hasValidMimeType) {
        console.error('❌ Invalid file type in upload hook:', {
          type: file.type,
          extension: fileExtension,
          name: file.name
        });
        throw new Error(`Please upload a valid image file. Supported formats: JPG, PNG, WebP, GIF, BMP, TIFF, SVG, HEIC, and more. File type: ${file.type || 'unknown'}, Extension: ${fileExtension || 'none'}`);
      }

      // If MIME type is empty but extension is valid, set a default content type for upload
      let contentType = file.type;
      if (!contentType && hasValidExtension) {
        // Map extension to MIME type
        const mimeTypeMap: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'jfif': 'image/jpeg',
          'png': 'image/png',
          'webp': 'image/webp',
          'gif': 'image/gif',
          'bmp': 'image/bmp',
          'tiff': 'image/tiff',
          'tif': 'image/tiff',
          'svg': 'image/svg+xml',
          'heic': 'image/heic',
          'heif': 'image/heif',
          'ico': 'image/x-icon',
          'avif': 'image/avif'
        };
        contentType = mimeTypeMap[fileExtension] || 'image/jpeg';
        console.log(`📝 Setting content type for gallery file: ${contentType} (was empty)`);
      }

      // Additional validation: ensure file is not a placeholder
      if (file.size < 100) {
        throw new Error('The selected file appears to be invalid or empty. Please select a valid image.');
      }

      // Validate file size (10MB limit - increased for larger images)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error(`Image size must be less than 10MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Simulate upload progress
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            if (progressInterval) clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Create new timeout for upload
      const uploadTimeoutPromise = new Promise<never>((_, reject) => {
        uploadTimeout = setTimeout(() => {
          reject(new Error('Upload timeout. Please check your connection and try again.'));
        }, 30000); // 30 second timeout
      });

      // Preferred: upload to ImageKit so images are served from its CDN instead
      // of counting against Supabase storage egress.
      if (isImageKitEnabled) {
        const { url } = await Promise.race([
          uploadToImageKit(file, folder, fileName),
          uploadTimeoutPromise
        ]);
        if (uploadTimeout) {
          clearTimeout(uploadTimeout);
          uploadTimeout = null;
        }
        if (progressInterval) clearInterval(progressInterval);
        setUploadProgress(100);
        return url;
      }

      // Fallback when ImageKit is not configured: Supabase Storage (dynamic folder/bucket)
      console.log('📤 Uploading image to Supabase Storage:', { folder, fileName, fileSize: file.size });

      // Now upload the file
      // Use the determined content type (may have been set from extension if MIME type was empty)
      const uploadPromise = supabase.storage
        .from(folder)
        .upload(fileName, file, {
          cacheControl: '31536000', // file names are unique, so cache for a year
          upsert: false,
          contentType: contentType || 'image/jpeg' // Fallback to jpeg if still empty
        });

      const uploadResult = await Promise.race([
        uploadPromise,
        uploadTimeoutPromise
      ]);

      // Clear timeout if upload succeeded
      if (uploadTimeout) {
        clearTimeout(uploadTimeout);
        uploadTimeout = null;
      }
      if (progressInterval) clearInterval(progressInterval);
      setUploadProgress(100);

      if (uploadResult.error) {
        console.error('❌ Supabase Storage upload error:', uploadResult.error);
        console.error('❌ Error details:', {
          message: uploadResult.error.message,
          statusCode: uploadResult.error.statusCode,
          error: uploadResult.error
        });

        // Provide helpful error message
        if (uploadResult.error.message?.includes('Bucket not found') || uploadResult.error.message?.includes('not found')) {
          throw new Error(`Storage bucket "${folder}" not found!\n\nPlease run the appropriate migration file in Supabase SQL Editor.`);
        } else if (uploadResult.error.message?.includes('new row violates row-level security') || uploadResult.error.message?.includes('row-level security')) {
          throw new Error('Storage policy error!\n\nPlease run CREATE_STORAGE_BUCKET.sql to set up policies.');
        } else if (uploadResult.error.message?.includes('mime type') || uploadResult.error.message?.includes('invalid mime')) {
          throw new Error('This file type is not allowed by storage. Please upload a JPG, PNG, WebP, GIF, HEIC, or HEIF image.');
        } else {
          throw new Error(`Upload failed: ${uploadResult.error.message || 'Unknown error'}`);
        }
      }

      if (!uploadResult.data) {
        throw new Error('Upload failed: No data returned');
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(folder)
        .getPublicUrl(uploadResult.data.path);

      console.log('✅ Image uploaded successfully:', { fileName, publicUrl });
      return publicUrl;
    } catch (error) {
      console.error('❌ Error uploading image:', error);
      if (uploadTimeout) clearTimeout(uploadTimeout);
      if (progressInterval) clearInterval(progressInterval);
      throw error;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const deleteImage = async (imageUrl: string): Promise<void> => {
    // ImageKit files can only be deleted with the private key (server-side);
    // removing the reference is enough — the file can be cleaned up in the ImageKit dashboard.
    if (isImageKitUrl(imageUrl)) return;

    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];

      const { error } = await supabase.storage
        .from(folder)
        .remove([fileName]);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  };

  return {
    uploadImage,
    deleteImage,
    uploading,
    uploadProgress
  };
};
