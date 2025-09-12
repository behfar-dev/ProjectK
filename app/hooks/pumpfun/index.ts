import { useState, useCallback } from 'react';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { uploadImageToIPFS, uploadMetadataToIPFS } from '@/lib/ipfs';

// Types
export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  file: File;
  showName?: boolean;
}

export interface TokenCreationConfig {
  rpcEndpoint: string;
  amount: number;
  denominatedInSol: boolean;
  slippage: number;
  priorityFee: number;
  pool: 'pump' | 'bonk' | 'moonshot';
}

export interface TokenCreationResult {
  signature: string;
  mintAddress: string;
  transactionUrl: string;
}

export interface TokenCreationState {
  isLoading: boolean;
  isUploadingMetadata: boolean;
  isCreatingTransaction: boolean;
  isSubmittingTransaction: boolean;
  error: string | null;
  result: TokenCreationResult | null;
  progress: number; // 0-100 for wizard progress
}

export interface UseTokenCreationReturn {
  state: TokenCreationState;
  createToken: (
    metadata: TokenMetadata,
    config: TokenCreationConfig,
    signer: Keypair | WalletLike
  ) => Promise<TokenCreationResult | null>;
  reset: () => void;
}

// Minimal wallet-like interface from wallet adapter to support signing
export type WalletLike = {
  publicKey: { toBase58: () => string } | null;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
};

// Hook implementation
export const useTokenCreation = (): UseTokenCreationReturn => {
  const [state, setState] = useState<TokenCreationState>({
    isLoading: false,
    isUploadingMetadata: false,
    isCreatingTransaction: false,
    isSubmittingTransaction: false,
    error: null,
    result: null,
    progress: 0,
  });

  const updateState = useCallback((updates: Partial<TokenCreationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const uploadMetadata = useCallback(async (metadata: TokenMetadata, pool: string): Promise<string> => {
    updateState({ 
      isUploadingMetadata: true, 
      progress: 25,
      error: null 
    });

    try {
      // Use consistent IPFS upload for image
      const imgUri = await uploadImageToIPFS(metadata.file);

      if (pool === 'pump') {
        // For pump.fun, create metadata JSON with required structure
        const metadataPayload = {
          name: metadata.name,
          symbol: metadata.symbol,
          description: metadata.description || '',
          image: imgUri,
          showName: true,
          createdOn: 'https://handz.fun',
          ...(metadata.website && { website: metadata.website }),
          // Include social links if provided (can be @username or full URLs)
          ...(metadata.twitter && { twitter: metadata.twitter }),
          ...(metadata.telegram && { telegram: metadata.telegram }),
        };

        // Upload metadata JSON to IPFS using the centralized function
        const metadataUri = await uploadMetadataToIPFS(metadataPayload);
        return metadataUri;
      } else {
        // Bonk/Moonshot metadata upload with clean structure for Thirdweb
        const metadataPayload: any = {
          name: metadata.name,
          symbol: metadata.symbol,
          description: metadata.description || '',
          image: imgUri,
          showName: true,
          createdOn: 'https://handz.fun',
          ...(metadata.website && { website: metadata.website }),
        };

        return await uploadMetadataToIPFS(metadataPayload);
      }
    } finally {
      updateState({ isUploadingMetadata: false });
    }
  }, [updateState]);

  const createUnsignedTransaction = useCallback(async (
    metadata: TokenMetadata,
    config: TokenCreationConfig,
    mintKeypair: Keypair,
    signerPublicKey: string,
    metadataUri: string
  ): Promise<Uint8Array> => {
    updateState({ 
      isCreatingTransaction: true, 
      progress: 50 
    });

    try {
      const tokenMetadata = {
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadataUri,
      };

      const payload = {
        publicKey: signerPublicKey,
        action: 'create',
        tokenMetadata,
        mint: mintKeypair.publicKey.toBase58(),
        denominatedInSol: config.denominatedInSol.toString(),
        amount: config.amount,
        slippage: config.slippage,
        priorityFee: config.priorityFee,
        pool: config.pool,
      };

      const response = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transaction creation error:', errorText);
        throw new Error(`Transaction creation failed: ${response.statusText} - ${errorText}`);
      }

      const transactionData = await response.arrayBuffer();
      return new Uint8Array(transactionData);
    } finally {
      updateState({ isCreatingTransaction: false });
    }
  }, [updateState]);

  const signAndSubmitTransaction = useCallback(async (
    unsignedTxData: Uint8Array,
    mintKeypair: Keypair,
    signer: Keypair | WalletLike,
    connection: Connection
  ): Promise<string> => {
    updateState({ 
      isSubmittingTransaction: true, 
      progress: 75 
    });

    try {
      const transaction = VersionedTransaction.deserialize(unsignedTxData);

      // Always sign with mint first
      transaction.sign([mintKeypair]);

      // If signer is a wallet adapter, request signature from wallet
      const maybeWallet = signer as WalletLike;
      if (maybeWallet && typeof maybeWallet.signTransaction === 'function' && 'publicKey' in maybeWallet) {
        const walletSigned = await maybeWallet.signTransaction(transaction);
        
        try {
          const signature = await connection.sendRawTransaction(walletSigned.serialize(), {
            maxRetries: 3,
            preflightCommitment: 'confirmed',
          });
          await connection.confirmTransaction(signature, 'confirmed');
          return signature;
        } catch (sendError: any) {
          console.error('Error submitting transaction:', sendError);
          if (sendError.message?.includes('403') || sendError.code === 403) {
            throw new Error('RPC endpoint rate limited (403). Please try again or use a different RPC endpoint.');
          }
          throw sendError;
        }
      }

      // Fallback to raw keypair (testing)
      const signerKeypair = signer as Keypair;
      transaction.sign([signerKeypair]);

      try {
        const signature = await connection.sendTransaction(transaction, {
          maxRetries: 3,
          preflightCommitment: 'confirmed',
        });

        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        return signature;
      } catch (sendError: any) {
        console.error('Error submitting transaction:', sendError);
        if (sendError.message?.includes('403') || sendError.code === 403) {
          throw new Error('RPC endpoint rate limited (403). Please try again or use a different RPC endpoint.');
        }
        throw sendError;
      }
    } finally {
      updateState({ isSubmittingTransaction: false });
    }
  }, [updateState]);

  const createToken = useCallback(async (
    metadata: TokenMetadata,
    config: TokenCreationConfig,
    signer: Keypair | WalletLike
  ): Promise<TokenCreationResult | null> => {
    try {
      updateState({
        isLoading: true,
        error: null,
        result: null,
        progress: 0,
      });

      // Generate mint keypair
      const mintKeypair = Keypair.generate();
      const connection = new Connection(config.rpcEndpoint, 'confirmed');

      // Step 1: Upload metadata
      updateState({ progress: 10 });
      const metadataUri = await uploadMetadata(metadata, config.pool);

      // Step 2: Create unsigned transaction
      updateState({ progress: 40 });
      const signerPublicKey = ('publicKey' in (signer as any) && (signer as any).publicKey
        ? (signer as any).publicKey.toBase58()
        : (signer as Keypair).publicKey.toBase58());
      
      const unsignedTxData = await createUnsignedTransaction(
        metadata,
        config,
        mintKeypair,
        signerPublicKey,
        metadataUri
      );

      // Step 3: Sign and submit transaction
      updateState({ progress: 70 });
      const signature = await signAndSubmitTransaction(
        unsignedTxData,
        mintKeypair,
        signer,
        connection
      );

      const result: TokenCreationResult = {
        signature,
        mintAddress: mintKeypair.publicKey.toBase58(),
        transactionUrl: `https://solscan.io/tx/${signature}`,
      };

      updateState({
        isLoading: false,
        result,
        progress: 100,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      updateState({
        isLoading: false,
        error: errorMessage,
        progress: 0,
      });
      return null;
    }
  }, [updateState, uploadMetadata, createUnsignedTransaction, signAndSubmitTransaction]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isUploadingMetadata: false,
      isCreatingTransaction: false,
      isSubmittingTransaction: false,
      error: null,
      result: null,
      progress: 0,
    });
  }, []);

  return {
    state,
    createToken,
    reset,
  };
};

// Utility hook for managing wizard steps
export const useTokenCreationWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tokenMetadata, setTokenMetadata] = useState<Partial<TokenMetadata>>({});
  const [tokenConfig, setTokenConfig] = useState<Partial<TokenCreationConfig>>({
    amount: 1,
    denominatedInSol: true,
    slippage: 10,
    priorityFee: 0.0005,
    pool: 'pump',
  });

  const tokenCreation = useTokenCreation();

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const updateMetadata = useCallback((updates: Partial<TokenMetadata>) => {
    setTokenMetadata(prev => ({ ...prev, ...updates }));
  }, []);

  const updateConfig = useCallback((updates: Partial<TokenCreationConfig>) => {
    setTokenConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(0);
    setTokenMetadata({});
    setTokenConfig({
      amount: 1,
      denominatedInSol: true,
      slippage: 10,
      priorityFee: 0.0005,
      pool: 'pump',
    });
    tokenCreation.reset();
  }, [tokenCreation]);

  return {
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    tokenMetadata,
    updateMetadata,
    tokenConfig,
    updateConfig,
    tokenCreation,
    reset,
  };
};

/* 
USAGE EXAMPLES:

1. With Solana Wallet Adapter:

```tsx
import { useWallet } from '@solana/wallet-adapter-react';

function TokenCreationWizard() {
  const wallet = useWallet();
  const { tokenCreation } = useTokenCreationWizard();
  
  const handleCreateToken = async () => {
    if (!wallet.connected) {
      // Trigger wallet connection
      await wallet.connect();
    }
    
    const result = await tokenCreation.createToken(
      metadata,
      config,
      wallet // Pass wallet adapter directly
    );
  };
}
```

2. With raw keypair (for testing/scripts):

```tsx
import { Keypair } from '@solana/web3.js';

const keypair = Keypair.fromSecretKey(bs58.decode('your-secret-key'));
const result = await createToken(metadata, config, keypair);
```

3. Required dependencies:

```bash
npm install @solana/wallet-adapter-react @solana/wallet-adapter-wallets
npm install @solana/wallet-adapter-react-ui @solana/web3.js bs58
```

4. Wallet setup in your app:

```tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
];

function App() {
  return (
    <ConnectionProvider endpoint="https://api.mainnet-beta.solana.com">
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <YourTokenCreationComponent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```
*/