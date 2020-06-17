import { Crypto, Enums, Utils, Managers, Transactions, Identities } from "@arkecosystem/crypto"

import { httpie } from "@arkecosystem/core-utils"
import assert = require("assert");


import { testWallets, seeds } from "./config/testnet"
import { config } from "./config/config"
import { Client } from "./client"
import { builders } from "./builders"

/**
 * $ node index.js
 * Ѧ 0      ENTER - send a transfer
 * Ѧ 0 10   ENTER - send 10 transfers
 *
 * CTRL-C to exit.
 * Use config below to tweak script and make it deterministic.
 *
 * TIPS:
 *
 * Once V2 milestone is active:
 * If you get nonce errors, try restarting the script first. It caches the
 * nonces and always increments for each sent transaction even if it ends up getting rejected.
 *
 * - At the bottom of this file are `testWallets` each with a balance of 475 DARK.
 * - If you encounter an error, just CTRL-C and restart.

 * Types:
 * 0 - Transfer
 * 1 - SecondSignature
 * 2 - DelegateRegistration
 * 3 - Vote
 * 4 - MultiSignature
 * 5 - IPFS
 * 6 - MultiPayment
 * 7 - DelegateResignation
 * 8 - HTLC Lock
 * 9 - HTLC Claim
 * 10 - HTLC Refund
 *
 * (These types are actually wrong and only used in this script to keep things simple)
 * 11 - BusinessRegistration
 * 12 - BusinessResignation
 * 13 - BusinessUpdate
 * 14 - BridgechainRegistration
 * 15 - BridgechainResignation
 * 16 - BridgechainUpdate
 *
 * Multisignature:
 * - First register a new multisig wallet (address is derived from the asset `participants` and `min`)
 * - The script will print the new multisig wallet address
 * - After creation send funds to this wallet, set `recipientId` in this script
 * - Finally, `enable` the multisignature by setting it to `true` in the config, do not change the asset at this point
 *   since it is used to derive the address
 * - All outgoing transactions will now be multi signed with the configured `passphrases`
 * - Remove passphrases and change indexes to test `min` etc.
 */

const randomSeed = () => {
    if (config.peer) {
        return config.peer;
    }

    return seeds[Math.floor(Math.random()*seeds.length)];
}

const client = new Client(randomSeed())

const configureCrypto = async () => {
    Managers.configManager.setFromPreset("testnet");

    try {
        const height = await client.retrieveHeight()

        Managers.configManager.setHeight(height)
    } catch (ex) {
        console.log("configureCrypto: " + ex.message);
        process.exit()
    }
}

const prompt = (question, callback: Function) => {
    const stdin = process.stdin;
    const stdout = process.stdout

    stdin.resume();
    stdout.write(question);

    stdin.once('data', (data) => {
        callback(data.toString().trim());
    });
}

const nonces = {}



const main = async (data) => {
    try {
        await configureCrypto();

        let [type, quantity] = data.split(" ");

        type = +type;
        quantity = quantity || 1;

        const builder = builders[type];
        if (!builder) {
            throw new Error("Unknown type");
        }

        const senderSecret = config.passphrase || testWallets[Math.floor(Math.random()*testWallets.length)].passphrase;
        const recipientSecret = testWallets[Math.floor(Math.random()*testWallets.length)].passphrase;

        const senderKeys = Identities.Keys.fromPassphrase(senderSecret);
        const recipientId = config.recipientId || Identities.Address.fromPassphrase(recipientSecret);

        const senderWallet = await client.retrieveSenderWallet(Identities.Address.fromPublicKey(senderKeys.publicKey));
        if (!senderWallet.publicKey) {
            senderWallet.publicKey = senderKeys.publicKey;
        }

        const transactions = [];

        for (let i = 0; i < quantity; i++) {
            let nonce = nonces[senderKeys.publicKey];
            if (!nonce) {
                let senderNonce = senderWallet.nonce;
                if (config.multiSignature.enabled) {
                    senderNonce = (await client.retrieveSenderWallet(multiSignatureAddress().address)).nonce;
                }

                nonce = Utils.BigNumber.make(config.startNonce || senderNonce || 0).plus(1);
            } else {
                nonce = nonce.plus(1);
            }
            nonces[senderKeys.publicKey] = nonce;

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
                    const networktime = await client.retrieveNetworktime();
                    if (config.htlc.lock.expiration.value < networktime) {
                        config.htlc.lock.expiration.value += networktime;
                    }
                }

                transaction.htlcLockAsset(config.htlc.lock);
            } else if (type === Enums.TransactionType.HtlcClaim && Managers.configManager.getMilestone().aip11) {

                const claim = config.htlc.claim;
                const lockTransactionId = claim.lockTransactionId || ((await client.retrieveTransaction(senderWallet.publicKey, 8))[0].id)

                transaction.htlcClaimAsset({ ...claim, lockTransactionId});

            } else if (type === Enums.TransactionType.HtlcRefund && Managers.configManager.getMilestone().aip11) {
                const refund = config.htlc.refund;
                const lockTransactionId = refund.lockTransactionId || ((await client.retrieveTransaction(senderWallet.publicKey, 8))[0].id)

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

        await client.postTransaction(transactions)

    } catch (ex) {
        console.log(ex.message);
    } finally {
        prompt(`Ѧ `, main);
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

prompt(`Ѧ `, main);
