import { builders } from "./builders"
import {config} from "./config/config";
import {testWallets} from "./config/testnet";
import {Crypto, Enums, Identities, Managers, Transactions, Utils} from "@arkecosystem/crypto";

import assert = require("assert");


const multiSignatureAddress = () => {
    return {
        publicKey: Identities.PublicKey.fromMultiSignatureAsset({
            min: config.multiSignature.asset.min,
            publicKeys: config.multiSignature.asset.participants.map(passphrase => Identities.PublicKey.fromPassphrase(passphrase)),
        }),
        address: Identities.Address.fromMultiSignatureAsset({
            min: config.multiSignature.asset.min,
            publicKeys: config.multiSignature.asset.participants.map(passphrase => Identities.PublicKey.fromPassphrase(passphrase)),
        }),
    }
}

const sign = (builder, passphrase) => {
    if (!config.ecdsa) {
        builder.sign(passphrase)
    } else {
        const buffer = Transactions.Utils.toHash(builder.data, {
            excludeSignature: true,
            excludeSecondSignature: true,
        });

        builder.data.signature = Crypto.Hash.signECDSA(buffer, Identities.Keys.fromPassphrase(passphrase));
    }
}

const secondSign = (builder, passphrase) => {
    if (!config.ecdsa) {
        builder.secondSign(passphrase);
    } else {

        const buffer = Transactions.Utils.toHash(builder.data, {
            excludeSecondSignature: true,
        });

        builder.data.secondSignature = Crypto.Hash.signECDSA(buffer, Identities.Keys.fromPassphrase(passphrase));
    }
}

export class Builder {
    constructor(private app: any) {
    }

    async buildTransaction(type: number, quantity: number) {
        const builder = builders[type];
        if (!builder) {
            throw new Error("Unknown type");
        }

        const senderSecret = config.passphrase || testWallets[Math.floor(Math.random()*testWallets.length)].passphrase;
        const recipientSecret = testWallets[Math.floor(Math.random()*testWallets.length)].passphrase;

        const senderKeys = Identities.Keys.fromPassphrase(senderSecret);
        const recipientId = config.recipientId || Identities.Address.fromPassphrase(recipientSecret);

        const senderWallet = await this.app.client.retrieveSenderWallet(Identities.Address.fromPublicKey(senderKeys.publicKey));
        if (!senderWallet.publicKey) {
            senderWallet.publicKey = senderKeys.publicKey;
        }

        const transactions = [];

        for (let i = 0; i < quantity; i++) {
            let nonce = this.app.nonces[senderKeys.publicKey];
            if (!nonce) {
                let senderNonce = senderWallet.nonce;
                if (config.multiSignature.enabled) {
                    senderNonce = (await this.app.client.retrieveSenderWallet(multiSignatureAddress().address)).nonce;
                }

                nonce = Utils.BigNumber.make(config.startNonce || senderNonce || 0).plus(1);
            } else {
                nonce = nonce.plus(1);
            }
            this.app.nonces[senderKeys.publicKey] = nonce;

            const transaction = builder()
                .nonce(nonce.toFixed())
                .senderPublicKey(senderKeys.publicKey);

            if (config.fee) {
                transaction.fee(config.fee)
            }

            if (type === Enums.TransactionType.Transfer) {
                transaction.recipientId(recipientId)
                transaction.amount(config.amount);
                transaction.expiration(config.expiration || 0);

            } else if (type === Enums.TransactionType.SecondSignature) {
                const secondPassphrase = config.secondPassphrase || "second passphrase";
                transaction.signatureAsset(secondPassphrase);

            } else if (type === Enums.TransactionType.DelegateRegistration) {
                const username = config.delegateName || `delegate.${senderKeys.publicKey.slice(0, 10)}`;
                transaction.usernameAsset(username);

            } else if (type === Enums.TransactionType.Vote) {
                if (config.vote) {
                    transaction.votesAsset([`+${config.vote}`]);
                } else if (config.unvote) {
                    transaction.votesAsset([`-${config.unvote}`]);
                } else {
                    if (senderWallet.vote) {
                        transaction.votesAsset([`-${senderWallet.vote}`])
                    } else {
                        transaction.votesAsset([`+${senderKeys.publicKey}`])
                    }
                }

            } else if (type === Enums.TransactionType.MultiSignature && Managers.configManager.getMilestone().aip11) {
                for (const passphrase of config.multiSignature.asset.participants) {
                    transaction.participant(Identities.PublicKey.fromPassphrase(passphrase));
                }

                transaction.min(config.multiSignature.asset.min)

            } else if (type === Enums.TransactionType.Ipfs && Managers.configManager.getMilestone().aip11) {
                transaction.ipfsAsset(config.ipfs)

            } else if (type === Enums.TransactionType.MultiPayment && Managers.configManager.getMilestone().aip11) {

                let payments;
                if (!config.multiPayments || config.multiPayments.length === 0) {
                    payments = [];
                    const count = Math.floor(Math.random() * (128 - 64 + 1) + 64);
                    for (let i = 0; i < count; i++) {
                        payments.push({
                            recipientId: testWallets[i % testWallets.length].address,
                            amount: "1"
                        });
                    }
                } else {
                    payments = config.multiPayments;
                }

                for (const payment of payments) {
                    transaction.addPayment(payment.recipientId, payment.amount);
                }

            } else if (type === Enums.TransactionType.DelegateResignation && Managers.configManager.getMilestone().aip11) {

            } else if (type === Enums.TransactionType.HtlcLock && Managers.configManager.getMilestone().aip11) {
                transaction.recipientId(recipientId)
                transaction.amount(config.amount);

                if (config.htlc.lock.expiration.type === Enums.HtlcLockExpirationType.EpochTimestamp) {
                    const networktime = await this.app.client.retrieveNetworktime();
                    if (config.htlc.lock.expiration.value < networktime) {
                        config.htlc.lock.expiration.value += networktime;
                    }
                }

                transaction.htlcLockAsset(config.htlc.lock);
            } else if (type === Enums.TransactionType.HtlcClaim && Managers.configManager.getMilestone().aip11) {

                const claim = config.htlc.claim;
                const lockTransactionId = claim.lockTransactionId || ((await this.app.client.retrieveTransaction(senderWallet.publicKey, 8))[0].id)

                transaction.htlcClaimAsset({ ...claim, lockTransactionId});

            } else if (type === Enums.TransactionType.HtlcRefund && Managers.configManager.getMilestone().aip11) {
                const refund = config.htlc.refund;
                const lockTransactionId = refund.lockTransactionId || ((await this.app.client.retrieveTransaction(senderWallet.publicKey, 8))[0].id)

                transaction.htlcRefundAsset({ lockTransactionId });
            } else {
                throw new Error("Version 2 not supported.");
            }

            let vendorField = config.vendorField.value;
            if (!vendorField && config.vendorField.random && (type === 0 || type === 6 || type === 8)) {
                vendorField = Math.random().toString();
            }

            if (vendorField) {
                transaction.vendorField(vendorField);
            }

            if (config.multiSignature.enabled && type !== 4) {
                const multiSigAddress = multiSignatureAddress();
                transaction.senderPublicKey(multiSigAddress.publicKey);
                console.log(`MultiSignature: ${JSON.stringify(multiSigAddress, undefined, 4)}`);
            }

            if (config.multiSignature.enabled || type === 4) {
                if (type === 4) {
                    const multiSignatureAddress = Identities.Address.fromMultiSignatureAsset(transaction.data.asset.multiSignature);
                    console.log(`Created MultiSignature address: ${multiSignatureAddress}`);
                    transaction.senderPublicKey(senderWallet.publicKey);

                    const participants = config.multiSignature.asset.participants;
                    for (let i = 0; i < participants.length; i++) {
                        transaction.multiSign(participants[i], i);
                    }
                } else {
                    for (const {index, passphrase} of config.multiSignature.passphrases) {
                        transaction.multiSign(passphrase, index);
                    }
                }
            }

            if (!config.multiSignature.enabled || type === 4) {
                sign(transaction, senderSecret);

                if (config.secondPassphrase) {
                    secondSign(transaction, config.secondPassphrase);
                } else if (senderWallet.secondPublicKey) {
                    secondSign(transaction, "second passphrase");
                }
            }

            const instance = transaction.build();
            const payload = instance.toJson();

            if (config.verbose) {
                console.log(`Transaction: ${JSON.stringify(payload, undefined, 4)}`);
            }

            assert(instance.verify() || config.multiSignature.enabled);
            transactions.push(payload);
        }

        return transactions
    }
}
