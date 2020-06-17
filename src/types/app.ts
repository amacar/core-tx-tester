import {WalletRepository} from "../wallets-repository";
import {Client} from "../client";

export interface App {
    client: Client
    walletRepository: WalletRepository

    nonces: any,

}
