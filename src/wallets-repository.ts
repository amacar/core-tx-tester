interface Wallet {
    passphrase: string,
    address: string,
    publicKey: string
}

export class WalletRepository {
    private wallets: Wallet[] = []

    public constructor(wallets: Wallet[]) {
        this.wallets = wallets
    }

    public getRandomWallet(): Wallet {
        return this.wallets[Math.floor(Math.random()*this.wallets.length)];
    }
}
