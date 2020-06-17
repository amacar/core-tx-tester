import { Wallet } from "./types";

export class WalletRepository {
    private wallets: Wallet[] = []

    public constructor(wallets: Wallet[]) {
        this.wallets = wallets
    }

    public getWallets(): Wallet[] {
        return this.wallets;
    }

    public getRandomWallet(): Wallet {
        return this.wallets[Math.floor(Math.random()*this.wallets.length)];
    }
}
