import {customAlphabet} from "nanoid";
import * as anchor from "@project-serum/anchor";
import {sleep, SwitchboardTestContext} from "@switchboard-xyz/sbv2-utils";
import {Program} from "@project-serum/anchor";
import {readFileSync} from "fs";
import {Keypair, PublicKey} from "@solana/web3.js";
import {AggregatorAccount, CrankAccount, OracleQueueAccount} from "@switchboard-xyz/switchboard-v2";
import { SwitchboardBuffer } from "../target/types/switchboard_buffer";


export const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 5)
export const nanoidInt = customAlphabet('123456789', 5)



export const getRunner = async ({
    walletIn,
    aggregator,
    crank,
    queue,
    switchboardToken,
}:{
    walletIn?: anchor.Wallet,
    aggregator?: boolean,
    crank?: boolean,
    queue?: boolean,
    switchboardToken?:boolean,

}) => {
    console.log(process.env.SWITCHBOARD_PROGRAM_ID,99)
    const provider = anchor.AnchorProvider.env();
    const switchboard = await SwitchboardTestContext.loadFromEnv(provider);
    anchor.setProvider(provider);
    const program = anchor.workspace.SwitchboardBuffer as Program<SwitchboardBuffer>;
    const wallet = walletIn ?? provider.wallet as anchor.Wallet;

    const programId = program.programId;
    const userAccount = readFileSync("user.key","binary")
    const user =  Keypair.fromSecretKey(new Uint8Array(JSON.parse(userAccount)))

    const queueAccount = queue ? new OracleQueueAccount({
        program: switchboard.program,
        publicKey:new PublicKey(readFileSync("queue.key","binary"))
    }) : null;
    const crankAccount = crank ? new CrankAccount({
        program: switchboard.program,
        publicKey:new PublicKey(readFileSync("crank.key","binary"))
    }) : null;


    return ({
        provider,
        program,
        wallet,
        user,
        programId,
        ...(aggregator && {
            aggregatorAccount:new AggregatorAccount({
                program:switchboard.program,
                publicKey:new PublicKey(readFileSync("aggregator.key","binary"))
            }),
            aggregatorDataAccount:await new AggregatorAccount({
                program:switchboard.program,
                publicKey:new PublicKey(readFileSync("aggregator.key","binary"))
            }).loadData(),
            aggregatorPublicKey: new PublicKey(readFileSync("aggregator.key","binary")),
        }),
        ...(crank && {
            crankData: await crankAccount.loadData(),
            crankAccount: await crankAccount,
        }),
        ...(queue && {
            queueData: await queueAccount.loadData(),
            queueAccount,
        }),
        ...(switchboardToken && {
            switchboardToken: new PublicKey(readFileSync("switchboard.token","binary"))
        })
    })
}