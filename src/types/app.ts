import {WalletRepository} from "../wallets-repository";
import {Client} from "../client";
import {Prompt} from "../prompt";

interface Config {
    network: string
}

export interface App {
    config: Config

    client: Client
    walletRepository: WalletRepository

    nonces: any
    prompt: Prompt
}


