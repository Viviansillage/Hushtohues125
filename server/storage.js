import { supabase } from './supabase.js';

/**
 * 上传图片到 Supabase Storage
 * @param {File|Buffer|Blob} file - 图片文件
 * @param {string} fileName - 文件名
 * @param {string} bucket - 存储桶名称，默认为 'images'
 * @returns {Promise<string>} - 图片的公开URL
 */
export async function uploadImage(file, fileName, bucket = 'images') {
  try {
    // 生成唯一文件名（添加时间戳防止重名）
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}-${fileName}`;

    // 上传文件
    const { data, error } = await supabase
      .storage
      .from(bucket)
      .upload(uniqueFileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw error;
    }

    // 获取公开 URL
    const { data: { publicUrl } } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Upload image error:', error);
    throw error;
  }
}

/**
 * 上传 Base64 编码的图片
 * @param {string} base64Data - Base64 编码的图片数据（包含 data:image/... 前缀）
 * @param {string} fileName - 文件名
 * @param {string} bucket - 存储桶名称
 * @returns {Promise<string>} - 图片的公开URL
 */
export async function uploadBase64Image(base64Data, fileName, bucket = 'images') {
  try {
    // 解析 Base64 数据
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 image data');
    }

    const imageType = matches[1]; // png, jpeg, etc.
    const base64Content = matches[2];
    
    // 将 Base64 转换为 Buffer
    const buffer = Buffer.from(base64Content, 'base64');
    
    // 生成文件名（如果没有扩展名，添加扩展名）
    const fileNameWithExt = fileName.includes('.') 
      ? fileName 
      : `${fileName}.${imageType}`;

    // 上传
    return await uploadImage(buffer, fileNameWithExt, bucket);
  } catch (error) {
    console.error('Upload base64 image error:', error);
    throw error;
  }
}

/**
 * 删除 Supabase Storage 中的图片
 * @param {string} fileUrl - 文件的公开URL或路径
 * @param {string} bucket - 存储桶名称
 */
export async function deleteImage(fileUrl, bucket = 'images') {
  try {
    // 从 URL 中提取文件路径
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase
      .storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Delete image error:', error);
    throw error;
  }
}

/**
 * 批量上传图片
 * @param {Array<File|Buffer|Blob>} files - 图片文件数组
 * @param {string} bucket - 存储桶名称
 * @returns {Promise<Array<string>>} - 图片URL数组
 */
export async function uploadMultipleImages(files, bucket = 'images') {
  try {
    const uploadPromises = files.map((file, index) => {
      const fileName = file.name || `image-${index}.png`;
      return uploadImage(file, fileName, bucket);
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Upload multiple images error:', error);
    throw error;
  }
}
