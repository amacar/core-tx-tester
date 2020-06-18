import {Wallet, WalletChange} from "./types";
import {WalletSignType} from "./enums";

import {Transactions} from "@arkecosystem/crypto";

export class WalletRepository {
    private wallets: Wallet[] = [];

    public constructor(wallets: Wallet[]) {
        for(let wallet of wallets) {
            if (wallet.passphrase && wallet.secondPassphrase) {
                wallet.signType = WalletSignType.SecondSignature
            } else if (wallet.passphrases) {
                wallet.signType = WalletSignType.MultiSignature
            } else if (wallet.passphrase) {
                wallet.signType = WalletSignType.Basic
            } else {
                throw new Error(`Error loading wallet: ${wallet}`)
            }
            this.wallets.push(wallet)
        }
    }

    public getWallets(): Wallet[] {
        return this.wallets;
    }

    public addWallet(wallet: Wallet) {
        this.wallets.push(wallet)
    }

    public getWallet(address: string): Wallet {
        let wallet = this.wallets.find(x => x.address === address);

        if (!wallet) {
            throw new Error(`Wallet ${address} not found`);
        }

        return wallet;
    }

    public getRandomWallet(): Wallet {
        return this.wallets[Math.floor(Math.random()*this.wallets.length)];
    }

    public handleWalletChanges(walletChanges: WalletChange[], response) {
        if (response.data.accept) {
            for (let walletChange of walletChanges) {
                const id = Transactions.Utils.getId(walletChange.transaction.build().data)

                if (response.data.accept.includes(id)) {
                    if (walletChange.secondPassphrase) {
                        const wallet = this.getWallet(walletChange.address)

                        wallet.signType = WalletSignType.SecondSignature
                        wallet.secondPassphrase = walletChange.secondPassphrase
                    } else {
                        // @ts-ignore
                        const wallet: Wallet = {
                            signType: WalletSignType.MultiSignature,
                            passphrases: walletChange.passphrases,
                            address: walletChange.address,
                            publicKey: walletChange.publicKey
                        }

                        this.addWallet(wallet);
                    }
                }
            }
        }
    }
}
