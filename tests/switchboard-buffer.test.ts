import * as anchor from "@project-serum/anchor";
import {
  promiseWithTimeout,
  sleep,
  SwitchboardTestContext,
} from "@switchboard-xyz/sbv2-utils";
import {
  AnchorWallet,
  BufferRelayerAccount,
  JobAccount,
  PermissionAccount,
  SwitchboardPermission,
} from "@switchboard-xyz/switchboard-v2";
import { SwitchboardBuffer } from "../target/types/switchboard_buffer";
import { OracleJob } from "@switchboard-xyz/common";
import chalk from "chalk";

const CHECK_ICON = chalk.green("\u2714");
const FAILED_ICON = chalk.red("\u2717");

describe("switchboard-buffer", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .SwitchboardBuffer as anchor.Program<SwitchboardBuffer>;

  const connection = provider.connection;

  const payer = (
    (program.provider as anchor.AnchorProvider).wallet as AnchorWallet
  ).payer;

  let switchboard: SwitchboardTestContext;

  let bufferAccount: BufferRelayerAccount;

  before(async () => {
    try {
      switchboard = await SwitchboardTestContext.loadFromEnv(
        program.provider as anchor.AnchorProvider,
        undefined,
        5_000_000 // .005 wSOL
      );
      console.log("local env detected");
    } catch (error: any) {
      console.log(
        `Failed to load the SwitchboardTestContext from a switchboard.env file`
      );
      throw error;
    }

    if (!switchboard) {
      throw new Error(
        `Failed to load the SwitchboardTestContext from a switchboard.env file`
      );
    }

    const queueState = await switchboard.queue.loadData();
    if (!payer.publicKey.equals(queueState.authority)) {
      throw new Error(
        `Queue authority mismatch, received ${payer.publicKey}, expected ${queueState.authority}`
      );
    }

    if (switchboard.oracle) {
      let oracleState = await switchboard.oracle.loadData();

      if (!payer.publicKey.equals(oracleState.oracleAuthority)) {
        throw new Error(
          `Oracle authority mismatch, received ${payer.publicKey}, expected ${oracleState.oracleAuthority}`
        );
      }

      let counter = 0;
      while (
        Date.now() / 1000 -
          (await switchboard.oracle.loadData()).lastHeartbeat.toNumber() >
        30
      ) {
        if (counter > 30) {
          throw new Error(`Failed to find any active oracles heartbeating`);
        }
        await sleep(1000);
        counter++;
      }

      console.log(CHECK_ICON, `Successfully detected oracle heartbeat`);
    }
  });

  it("create buffer", async () => {
    const queueState = await switchboard.queue.loadData();

    const jobAccount = await JobAccount.create(switchboard.program, {
      data: Buffer.from(
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
      ),
      keypair: anchor.web3.Keypair.generate(),
      authority: payer.publicKey,
    });
    console.log(CHECK_ICON, `JobAccount created: ${jobAccount.publicKey}`);

    bufferAccount = await BufferRelayerAccount.create(switchboard.program, {
      name: Buffer.from("My Buffer"),
      minUpdateDelaySeconds: 5,
      queueAccount: switchboard.queue,
      authority: payer.publicKey,
      jobAccount,
    });
    console.log(
      CHECK_ICON,
      `BufferRelayerAccount created: ${bufferAccount.publicKey}`
    );

    const permissionAccount = await PermissionAccount.create(
      switchboard.program,
      {
        granter: switchboard.queue.publicKey,
        grantee: bufferAccount.publicKey,
        authority: queueState.authority,
      }
    );
    console.log(
      CHECK_ICON,
      `PermissionAccount created: ${permissionAccount.publicKey}`
    );

    await permissionAccount.set({
      authority: payer,
      enable: true,
      permission: SwitchboardPermission.PERMIT_ORACLE_QUEUE_USAGE,
    });
    console.log(
      CHECK_ICON,
      `Permissions set: ${SwitchboardPermission.PERMIT_ORACLE_QUEUE_USAGE}`
    );
  });

  it("buffer open round", async () => {
    if (!bufferAccount) {
      throw new Error(`No BufferRelayerAccount to reference`);
    }

    const resultPromise = awaitCallback(bufferAccount, 30);

    const txnSignature = await bufferAccount.openRound();
    console.log(
      CHECK_ICON,
      `BufferRelayerAccount open round called successfully: https://explorer.solana.com/tx/${txnSignature}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`
    );

    const result = await resultPromise;
    if (!result || result.byteLength === 0) {
      throw new Error(`Failed to yield a BufferRelayerAccount result`);
    }

    console.log(
      CHECK_ICON,
      `BufferRelayerAccount result: [${new Uint8Array(result)}]`
    );
  });
});

async function awaitCallback(
  bufferAccount: BufferRelayerAccount,
  timeoutInterval: number,
  errorMsg = "Timed out waiting for Buffer Relayer open round."
) {
  const acctCoder = new anchor.BorshAccountsCoder(bufferAccount.program.idl);
  let ws: number | undefined = undefined;
  const result: Buffer = await promiseWithTimeout(
    timeoutInterval,
    new Promise(
      (resolve: (result: Buffer) => void, reject: (reason: string) => void) => {
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
