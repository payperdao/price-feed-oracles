import {
  Account,
  AleoKeyProvider,
  ProgramManager,
  initThreadPool,
} from "@aleohq/sdk";
import { exec } from "node:child_process";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { config } from "./config";
import { InjectedAccount, OraclePrice, medianatorSdk } from "./medianatorSdk";
import { BinancePriceGetter } from "./price";
await initThreadPool();

async function main() {
  const priceGetter = new BinancePriceGetter();

  const programManager = new ProgramManager();
  const account = new Account({ privateKey: config.ORACLE_PRIVATE_KEY });
  programManager.setAccount(account);
  // Create a key provider in order to re-use the same key for each execution
  const keyProvider = new AleoKeyProvider();
  keyProvider.useCache(true);
  programManager.setKeyProvider(keyProvider);

  /**
   * To make it compatible with `InjectedAccount`
   */
  const accountInterface: Pick<InjectedAccount, "execute"> = {
    execute: async (programName, functionName, fee, inputs) => {
      await programManager.execute(
        programName,
        functionName,
        fee,
        false, // fee is private
        inputs,
      );
    },
  };

  const price = await priceGetter.getPrice();
  const signature = await sign(price, account);
  console.log(
    "oracle",
    account.address().to_string(),
    "\nprice",
    price.toExact(),
    "\nsignature",
    signature,
  );

  await medianatorSdk.setMedianatorPriceForOracle(accountInterface, {
    price: {
      oracle: account.address().to_string(),
      signature,
      price,
    },
  });
}

async function sign(price: OraclePrice, account: Account) {
  // TODO: use @aleohq/sdk to sign when it is implemented
  const cmd = path.join(dirname(fileURLToPath(import.meta.url)), "sign");
  const { stdout, stderr } = await promisify(exec)(
    `${cmd} --private-key ${account
      .privateKey()
      .to_string()} --price ${price.toExact()}`,
  );
  if (stderr) {
    throw new Error(stderr);
  }

  const res = JSON.parse(stdout);
  if (
    res.address?.toLowerCase() !== account.address().to_string().toLowerCase()
  ) {
    throw new Error("signature address does not match oracle address");
  }

  if (typeof res.signature !== "string") {
    throw new Error("signature is not a string");
  }
  return res.signature;
}

main();
