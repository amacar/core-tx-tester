import {WalletRepository} from "../wallets-repository";
import {Client} from "../client";
import {Prompt} from "../prompt";

export interface App {
    client: Client
    walletRepository: WalletRepository

    nonces: any,
    prompt: Prompt
}
