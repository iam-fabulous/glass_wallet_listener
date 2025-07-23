export interface Config {
  suiNetwork: "devnet" | "testnet" | "mainnet";
  backendConfirmationUrl: string;
  suiPrivateKey: string;
  javaStatusEndpoint: string;
}
