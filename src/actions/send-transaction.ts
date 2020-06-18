import {App} from "../types";
import {Action} from "../types/propmpt";
import {Builder} from "../builder";
import {transactions} from "../builders";

const sendTransaction = async (app: App, data: any) => {
    try {
        let [type, quantity, sender, recipient] = data.split(" ");

        type = +type;
        quantity = quantity || 1;

        let builder = new Builder(app)

        let { transactions, walletChanges } = await builder.buildTransaction(type, quantity, sender, recipient)

        let reponse = await app.client.postTransaction(transactions)

        app.walletRepository.handleWalletChanges(walletChanges, reponse)

    } catch (ex) {
        console.log(ex.message);
    }
}

const selectTransactionQuestion = () => {
    let question = "\nSelect transaction:";

    for(let key of Object.keys(transactions)) {
        question += `\n [${key}] - ${transactions[key]}`
    }

    question += "\n";

    return question;
}

export const action: Action = {
    description: "Send transaction",
    handler: async (app, data) => {
        await app.prompt.prompt(selectTransactionQuestion(), sendTransaction);
    }
}
