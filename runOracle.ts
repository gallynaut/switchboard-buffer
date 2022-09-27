import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import {
  sleep,
  SwitchboardTestContext,
  SwitchboardTestEnvironment,
} from "@switchboard-xyz/sbv2-utils";
import * as splToken from "@solana/spl-token2";
import { Keypair } from "@solana/web3.js";
import {
  AggregatorAccount,
  AnchorWallet,
  BufferRelayerAccount,
  CrankAccount,
  JobAccount,
  LeaseAccount,
  OracleAccount,
  OracleQueueAccount,
  PermissionAccount,
  SwitchboardPermission,
} from "@switchboard-xyz/switchboard-v2";
import { Buffer } from "buffer";
import { OracleJob } from "@switchboard-xyz/common";
import { writeFileSync } from "fs";
import { getRunner, nanoid } from "./tests/common";
import { SwitchboardBuffer } from "./target/types/switchboard_buffer";

const main = async () => {
  const testEnvironment = await SwitchboardTestEnvironment.create(
    "/Users/mac/.config/solana/id.json"
  );
  testEnvironment.writeAll(".switchboard");
  return;
  const aggregatorIn = Keypair.generate();
  writeFileSync("aggregator.secret", `[${aggregatorIn.secretKey.toString()}]`);
  writeFileSync("aggregator.key", `${aggregatorIn.publicKey.toString()}`);
  const userIn = Keypair.generate();
  writeFileSync("user.key", `[${userIn.secretKey.toString()}]`);
  const { provider, program, programId, user, wallet } = await getRunner({});
  await runOracle({
    program,
    provider,
    wallet,
    aggregator: aggregatorIn,
  });
};

const runOracle = async ({
  provider,
  program,
  wallet,
  aggregator,
}: {
  provider: AnchorProvider;
  program: Program<SwitchboardBuffer>;
  wallet: AnchorWallet;
  aggregator: Keypair;
}) => {
  const switchboard = await SwitchboardTestContext.loadFromEnv(provider);
  const queue = await switchboard.queue.loadData();

  const switchboardToken = await splToken.createAccount(
    program.provider.connection,
    wallet.payer,
    switchboard.mint.address,
    wallet.publicKey,
    Keypair.generate()
  );
  writeFileSync("switchboard.token", `${switchboardToken.toString()}`);

  const queueName = nanoid();
  console.log(queueName);
  const queueAccount = await OracleQueueAccount.create(switchboard.program, {
    name: Buffer.from(queueName),
    mint: splToken.NATIVE_MINT,
    slashingEnabled: false,
    reward: new anchor.BN(0), // no token account needed
    minStake: new anchor.BN(0),
    authority: wallet.publicKey,
    enableBufferRelayers: true,
  });
  writeFileSync("queue.key", `${queueAccount.publicKey.toString()}`);

  const crankAccountName = nanoid();
  const crankAccount = await CrankAccount.create(switchboard.program, {
    name: Buffer.from(crankAccountName),
    maxRows: 10,
    queueAccount,
  });
  writeFileSync("crank.key", `${crankAccount.publicKey.toString()}`);

  const oracleAccountName = nanoid();
  const oracleAccount = await OracleAccount.create(switchboard.program, {
    name: Buffer.from(oracleAccountName),
    queueAccount,
  });
  writeFileSync("oracle.key", `${oracleAccount.publicKey.toString()}`);

  const oraclePermission = await PermissionAccount.create(switchboard.program, {
    authority: wallet.publicKey,
    granter: queueAccount.publicKey,
    grantee: oracleAccount.publicKey,
  });
  await oraclePermission.set({
    authority: wallet.payer,
    permission: SwitchboardPermission.PERMIT_ORACLE_HEARTBEAT,
    enable: true,
  });
  await oraclePermission.set({
    authority: wallet.payer,
    permission: SwitchboardPermission.PERMIT_ORACLE_QUEUE_USAGE,
    enable: true,
  });
  await oracleAccount.heartbeat(wallet.payer);

  const aggregatorAccountName = nanoid();
  const aggregatorAccount = await AggregatorAccount.create(
    switchboard.program,
    {
      name: Buffer.from(aggregatorAccountName),
      keypair: aggregator,
      batchSize: 1,
      minRequiredOracleResults: 1,
      minRequiredJobResults: 1,
      minUpdateDelaySeconds: 10,
      queueAccount,
      authority: wallet.publicKey,
    }
  );
  const aggregatorPermission = await PermissionAccount.create(
    switchboard.program,
    {
      authority: wallet.publicKey,
      granter: queueAccount.publicKey,
      grantee: aggregatorAccount.publicKey,
    }
  );
  await aggregatorPermission.set({
    authority: wallet.payer,
    permission: SwitchboardPermission.PERMIT_ORACLE_QUEUE_USAGE,
    enable: true,
  });
  await aggregatorPermission.set({
    authority: wallet.payer,
    permission: SwitchboardPermission.PERMIT_ORACLE_HEARTBEAT,
    enable: true,
  });

  const leaseContract = await LeaseAccount.create(switchboard.program, {
    loadAmount: new anchor.BN(0),
    funder: switchboardToken,
    funderAuthority: wallet.payer,
    oracleQueueAccount: queueAccount,
    aggregatorAccount,
  });
  writeFileSync("lease.key", `${leaseContract.publicKey.toString()}`);

  const tasks: OracleJob.Task[] = [
    OracleJob.Task.create({
      httpTask: OracleJob.HttpTask.create({
        url: ` http://host.docker.internal:8080/games`,
      }),
    }),
  ];
  const jobData = Buffer.from(
    OracleJob.encodeDelimited(
      OracleJob.create({
        tasks,
      })
    ).finish()
  );
  const jobKeypair = anchor.web3.Keypair.generate();
  const jobAccount = await JobAccount.create(switchboard.program, {
    data: jobData,
    keypair: jobKeypair,
    authority: wallet.publicKey,
  });
  writeFileSync("job.key", `${jobAccount.publicKey.toString()}`);

  const bufferAccountName = nanoid();
  const bufferAccount = await BufferRelayerAccount.create(switchboard.program, {
    name: Buffer.from(bufferAccountName),
    minUpdateDelaySeconds: 30,
    queueAccount: switchboard.queue,
    authority: wallet.publicKey,
    jobAccount,
  });

  const permissionAccount = await PermissionAccount.create(
    switchboard.program,
    {
      granter: switchboard.queue.publicKey,
      grantee: bufferAccount.publicKey,
      authority: queue.authority,
    }
  );

  const addJob = await aggregatorAccount.addJob(jobAccount, wallet.payer);
  console.log(addJob, "addJob");
  const pushCrank = await crankAccount.push({ aggregatorAccount });
  console.log(pushCrank, "pushCrank");
  console.log(aggregatorAccount.publicKey, "aggregatorAccount");

  // await bufferAccount.openRound()
  await sleep(5000);

  console.log(
    `agg ${aggregator.publicKey.toString()}`,
    `oracle ${oracleAccount.publicKey.toString()}`,
    `${wallet.payer.publicKey.toString()}`
  );
  // await upAll({cwd: path.join(__dirname,".switchboard","docker-compose.switchboard.yml"), log: true })
};

main();
