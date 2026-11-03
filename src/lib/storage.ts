import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const bucket = process.env.S3_BUCKET;
export function client() { if (!bucket) throw new Error("S3_BUCKET is required"); return new S3Client({ region: process.env.S3_REGION || "us-east-1", endpoint: process.env.S3_ENDPOINT || undefined, forcePathStyle: !!process.env.S3_ENDPOINT, credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "" } : undefined }); }
export async function putImage(key: string, body: Buffer) { await client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "image/jpeg", CacheControl: "private, no-store" })); }
export async function putFile(key: string, body: Buffer, contentType: string) { await client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, no-store" })); }
export async function getObjectBytes(key: string) { const object = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key })); return object.Body?.transformToByteArray(); }
export async function signedImage(key: string) { return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 }); }
export async function signedDownload(key: string, fileName: string) { return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: `attachment; filename="${fileName.replace(/[\r\n"]/g, "")}"` }), { expiresIn: 600 }); }
export async function deleteImage(key: string) { await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); }
