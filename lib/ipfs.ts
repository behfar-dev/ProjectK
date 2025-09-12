import { createThirdwebClient } from "thirdweb";
import { upload } from "thirdweb/storage";
 

// Create Thirdweb client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || '24d0f024ecb29685318992f230a8762f',
  secretKey: process.env.NEXT_PUBLIC_THIRDWEB_SECRET_KEY || 'Dq4U2E4g9x-RqpSLfP5F3uP5VbeGDdkkCu3lwI7FoVexTEA-gOSFvAmzwyBZXwva-LGy-m8QeKeU33V8siGL_w'
  // Default public client ID for testing
});

export async function uploadImageToIPFS(file: File): Promise<string> {
  try {
    const uri = await upload({
      client,
      files: [file],
    });
    
    // Convert ipfs:// to https://ipfs.io/ipfs/ format
    const httpsUri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    return httpsUri;
  } catch (error) {
    console.error('Image upload failed:', error);
    throw new Error(`Image upload failed: ${error}`);
  }
}

export async function uploadMetadataToIPFS(metadata: object): Promise<string> {
  try {
    // Convert the metadata object to a JSON string manually to avoid wrapping
    const metadataString = JSON.stringify(metadata);
    const metadataBlob = new Blob([metadataString], { type: 'application/json' });
    const metadataFile = new File([metadataBlob], 'metadata.json', { type: 'application/json' });
    
    const uri = await upload({
      client,
      files: [metadataFile],
    });
    
    // Convert ipfs:// to https://ipfs.io/ipfs/ format
    const httpsUri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    return httpsUri;
  } catch (error) {
    console.error('Metadata upload failed:', error);
    throw new Error(`Metadata upload failed: ${error}`);
  }
}


