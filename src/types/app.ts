import {WalletRepository} from "../wallets-repository";
import {Client} from "../client";
import {Prompt} from "../prompt";
import {Filesystem} from "../filesystem";

interface Config {
    network: string
}

export interface App {
    config: Config

    client: Client
    walletRepository: WalletRepository,
    filesystem: Filesystem

    nonces: any
    prompt: Prompt
}


