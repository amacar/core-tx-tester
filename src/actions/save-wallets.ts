import {App} from "../types";
import { outputJson } from "fs-extra"
import { join } from "path"
import {Action} from "../types/propmpt";


export const action: Action = {
    description: "Save wallets",
    handler: async (app: App, data) => {
        const wallets = app.walletRepository.getWallets();
        console.log(join(__dirname, `../config/${app.config.network}/wallet-snapshot.json`));

        const path = join(__dirname, `../config/${app.config.network}/wallet-snapshot.json`)

        await  outputJson(path, wallets)
    }
}
