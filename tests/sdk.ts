import * as anchor from "@project-serum/anchor";
import {
  AnchorError,
  AnchorProvider,
  Program,
  Wallet,
} from "@project-serum/anchor";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token-v2";
import {
  promiseWithTimeout,
  sleep,
  SwitchboardTestContext,
} from "@switchboard-xyz/sbv2-utils";
import {
  AggregatorAccount,
  BufferRelayerAccount,
  CrankAccount,
  JobAccount,
  OracleQueueAccount,
  PermissionAccount,
  SwitchboardPermission,
} from "@switchboard-xyz/switchboard-v2";
import { nanoid } from "./common";
import { OracleJob } from "@switchboard-xyz/common";
import { SwitchboardBuffer } from "../target/types/switchboard_buffer";

export const turnCrank = async ({
  crankAccount,
  switchboardToken,
  queueAccount,
  queueAccountAuthority,
  switchboardMintAddress,
}: {
  crankAccount: CrankAccount;
  switchboardToken: PublicKey;
  queueAccount: OracleQueueAccount;
  queueAccountAuthority;
  switchboardMintAddress;
}) => {
  async function turnCrank(retryCount: number): Promise<number> {
    try {
      const readyPubkeys = await crankAccount.peakNextReady(5);
      if (readyPubkeys) {
        const crank = await crankAccount.loadData();
        const queue = await queueAccount.loadData();
        const crankTurnSignature = await crankAccount.popTxn({
          payoutWallet: switchboardToken,
          queuePubkey: queueAccount.publicKey,
          queueAuthority: queueAccountAuthority,
          readyPubkeys,
          nonce: 0,
          crank,
          queue,
          tokenMint: switchboardMintAddress,
        });

        console.log(crankTurnSignature, "crankTurnSignature");
        return 0;
      } else {
        return --retryCount;
      }
    } catch (e) {
      console.error(e, "hello boy");
      return --retryCount;
    }
  }

  let retryCount = 3;
  while (retryCount) {
    console.log(retryCount, "retryCount");
    try {
      await sleep(3000);
      retryCount = await turnCrank(retryCount);
    } catch (e) {
      console.log(retryCount, "ret12");
    }
  }
};

const network = () => {
  if (
    process.env.SOLANA_ENV === "devnet" ||
    process.env.SOLANA_ENV === "testnet" ||
    process.env.SOLANA_ENV === "mainnet-beta"
  ) {
    return clusterApiUrl(process.env.SOLANA_ENV);
  } else {
    return "http://127.0.0.1:8899";
  }
};

function getConnection() {
  return new Connection(network(), "confirmed");
}

const airdrop = async ({
  provider,
  pk,
}: {
  provider: AnchorProvider;
  pk: PublicKey;
}) => {
  const blockhash = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction({
    signature: await getConnection().requestAirdrop(
      pk,
      LAMPORTS_PER_SOL * 10000
    ),
    lastValidBlockHeight: blockhash.lastValidBlockHeight,
    blockhash: blockhash.blockhash,
  });
};

export type Runner = {
  wallet: Wallet;
  provider: AnchorProvider;
  program: Program<SwitchboardBuffer>;
  user: Keypair;
  programId: PublicKey;
  aggregatorAccount: AggregatorAccount;
  aggregatorDataAccount: any;
  aggregatorPublicKey: PublicKey;
  crankData?: any;
  crankAccount?: CrankAccount;
  queueData?: any;
  queueAccount: OracleQueueAccount;
  switchboardToken?: PublicKey;
};

export const setupTest = async ({
  turnCrankAction,
  pushBufferAction,
  runner,
}: {
  turnCrankAction?: boolean;
  pushBufferAction?: boolean;
  runner: Runner;
}) => {
  try {
    const { provider, program, wallet, user, aggregatorPublicKey } = runner;

    const {
      crankAccount,
      queueData,
      queueAccount,
      switchboardToken,
      aggregatorAccount,
    } = runner;

    console.log("user", user.publicKey.toString());

    const switchboard = await SwitchboardTestContext.loadFromEnv(provider);

    await airdrop({ provider, pk: user.publicKey });

    if (turnCrankAction) {
      const mint = await queueAccount.loadMint();

      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        wallet.payer,
        mint.address,
        wallet.publicKey
      );

      await turnCrank({
        crankAccount: crankAccount,
        queueAccount,
        switchboardMintAddress: switchboard.mint.address,
        // @ts-ignore
        queueAccountAuthority: queueData.authority,
        switchboardToken,
      });

      const round = await aggregatorAccount.openRound({
        oracleQueueAccount: queueAccount,
        payoutWallet: tokenAccount.address,
      });
      // const result = await aggregatorAccount.getLatestFeedTimestamp();
      console.log(round, "round");

      await sleep(10000);

      await program.methods
        .turnCrank()
        .accounts({
          userAuthority: user.publicKey,
          aggregator: aggregatorPublicKey,
        })
        .signers([user])
        .rpc(provider.connection)
        .catch((err: AnchorError) => {
          console.log(err, 444333);
        });
      console.log(9098);
    }

    if (pushBufferAction) {
      const jobData = Buffer.from(
        OracleJob.encodeDelimited(
          OracleJob.create({
            tasks: [
              OracleJob.Task.create({
                httpTask: OracleJob.HttpTask.create({
                  url: "http://host.docker.internal:8080/event",
                }),
              }),
            ],
          })
        ).finish()
      );
      const jobKeypair = anchor.web3.Keypair.generate();
      const jobAccount = await JobAccount.create(switchboard.program, {
        data: jobData,
        keypair: jobKeypair,
        authority: wallet.publicKey,
      });
      const bufferAccountName = nanoid();
      const bufferAccount = await BufferRelayerAccount.create(
        switchboard.program,
        {
          name: Buffer.from(bufferAccountName),
          minUpdateDelaySeconds: 1,
          queueAccount,
          authority: wallet.publicKey,
          jobAccount,
        }
      );
      const permissionAccount = await PermissionAccount.create(
        switchboard.program,
        {
          granter: queueAccount.publicKey,
          grantee: bufferAccount.publicKey,
          authority: queueData.authority,
        }
      );
      await permissionAccount.set({
        authority: wallet.payer,
        enable: true,
        permission: SwitchboardPermission.PERMIT_ORACLE_QUEUE_USAGE,
      });
      await permissionAccount.set({
        authority: wallet.payer,
        enable: true,
        permission: SwitchboardPermission.PERMIT_ORACLE_HEARTBEAT,
      });

      await sleep(5000);

      async function awaitCallback(
        bufferAccount: BufferRelayerAccount,
        timeoutInterval: number,
        errorMsg = "Timed out waiting for Buffer Relayer open round."
      ) {
        const acctCoder = new anchor.BorshAccountsCoder(
          bufferAccount.program.idl
        );
        let ws: number | undefined = undefined;
        const result: Buffer = await promiseWithTimeout(
          timeoutInterval,
          new Promise(
            (
              resolve: (result: Buffer) => void,
              reject: (reason: string) => void
            ) => {
              ws = bufferAccount.program.provider.connection.onAccountChange(
                bufferAccount.publicKey,
                async (
                  accountInfo: anchor.web3.AccountInfo<Buffer>,
                  context: anchor.web3.Context
                ) => {
                  const buf = acctCoder.decode(
                    "BufferRelayerAccountData",
                    accountInfo.data
                  );
                  const bufResult = buf.result as Buffer;
                  if (bufResult.byteLength > 0) {
                    resolve(bufResult);
                  }
                }
              );
            }
          ).finally(async () => {
            if (ws) {
              await bufferAccount.program.provider.connection.removeAccountChangeListener(
                ws
              );
            }
            ws = undefined;
          }),
          new Error(errorMsg)
        ).finally(async () => {
          if (ws) {
            await bufferAccount.program.provider.connection.removeAccountChangeListener(
              ws
            );
          }
          ws = undefined;
        });

        return result;
      }

      await bufferAccount.openRound();
      console.log(queueData.enableBufferRelayers, "buffer enabled");

      const buf = await awaitCallback(bufferAccount, 30_000);
      console.log(`Current Buffer Result: [${new Uint8Array(buf).toString()}]`);
      let ix = await program.methods
        .pushBuffer()
        .accounts({
          admin: user.publicKey,
          eventBufferRelayer: bufferAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user]);
      console.log(
        "data length",
        (await ix.instruction()).keys.map((f) => f.pubkey.toString()),
        await ix.transaction()
      );
      await ix.rpc(provider.connection).catch((err: AnchorError) => {
        console.log(err);
      });
    }
    return {};
  } catch (e) {
    console.log(e, "br");
  }
};
