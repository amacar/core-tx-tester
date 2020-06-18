import {App} from "../types";
import { copy } from "fs-extra"
import {Action} from "../types/propmpt";


export const action: Action = {
    description: "Save wallets",
    handler: async (app: App, data) => {
        console.log("Wallets: \n", app.walletRepository.getWallets())
        // await copy("../config/testnet/wallets.json", "../config/testnet/wallets-bkp.json")
    }
}
