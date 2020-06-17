export interface Wallet {
    passphrase: string,
    address: string,
    publicKey: string
}

export interface ExtendedWallet extends Wallet {
    secondPublicKey?: string
    nonce: any,
    vote: any,
}
