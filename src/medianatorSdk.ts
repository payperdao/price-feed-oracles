import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { ethers } from "ethers";
import { orderBy, pick } from "lodash-es";
import { SuperJSON } from "superjson";
import { assert } from "ts-essentials";
import { config } from "./config";

const MEDIANATOR_PROGRAM_NAME = "medianator_ajhfoeiufhofoeuhh14.aleo";
const MEDIANATOR_ORACLES_LENGTH = 16;
const DUMMY_ADDRESS: string =
  "aleo1kepmevud07adjx89sgte6755mmanscsj6fc3yn8dkp0qupld659qlcusq2";

const DUMMY_SIGNATURE: string =
  "sign17cwzkfm53fevma7r0g0lg5mxx5zhmengquqq74yhaegfjcalf5py8a646zcsxpecwpsczwf9warcy2n9xlvcwxmvz48vw4a9e2uuyq3jglyxezm98ra2q6v7kj4fw0ujrxrlgmp6mgr9ds8eu56azuvgpxfa65gxpcpq38xf7pvcx0rzkl4g7ssa8d4yrk5366dpzdrzexxsclwnmcq";

const trpcTransformer = new SuperJSON();
const trpcClient: any = createTRPCProxyClient({
  links: [
    httpBatchLink({
      url: config.TRPC_URL,
    }),
  ],
  transformer: trpcTransformer,
});

// puzzle wallet wrapper interface
export type InjectedAccount = {
  execute(
    programName: string,
    functionName: string,
    fee: number,
    inputs: string[],
  ): Promise<void>;
};

class MedianatorSdk {
  async setMedianatorPriceForOracle(
    account: Pick<InjectedAccount, "execute">,
    txInput: { price: MedianatorPriceInput },
  ) {
    let newPrices: MedianatorPriceInput[];
    {
      const medianFromBackend = await trpcClient.getPrices.query({});
      const medianPrices = (medianFromBackend?.median?.prices ?? []).map(
        (price: any) => ({
          ...price,
          price: OraclePrice.fromRawPrice(price.price),
        }),
      );
      newPrices = mergePrices(medianPrices, txInput.price);
    }
    const { sortedPrices } = this.calcMedianatorMedian({ prices: newPrices });
    await trpcClient.addPrice.mutate({
      prices: sortedPrices.map((p) => ({
        ...pick(p, ["signature"]),
        oracle: p.oracle,
        price: p.price.rawUnits,
      })),
    });

    const prices = encode.array(
      encode.u64,
      MEDIANATOR_ORACLES_LENGTH,
      BigInt(0),
    )(sortedPrices.map((price) => price.price.rawUnits));
    const oracles = encode.array<string>(
      encode.address,
      MEDIANATOR_ORACLES_LENGTH,
      DUMMY_ADDRESS,
    )(sortedPrices.map((price) => price.oracle));
    const signatures = encode.array(
      encode.signature,
      MEDIANATOR_ORACLES_LENGTH,
      DUMMY_SIGNATURE,
    )(sortedPrices.map((price) => price.signature));
    return await account.execute(
      MEDIANATOR_PROGRAM_NAME,
      "medianator_set_median",
      0.15, // fee
      [encode.u8(sortedPrices.length), prices, oracles, signatures],
    );
  }

  calcMedianatorMedian<T extends Pick<MedianatorPriceInput, "price">>({
    prices,
  }: {
    prices: T[];
  }) {
    assert(prices.length > 0, "no prices");
    const sortedPrices = orderBy(
      prices,
      (price) => price.price.rawUnits,
      "asc",
    );
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)]!.price;
    return { sortedPrices, median };
  }
}

export const medianatorSdk = new MedianatorSdk();

export function mergePrices(
  prices: MedianatorPriceInput[],
  newPrice: MedianatorPriceInput,
) {
  return [
    ...prices.filter(
      (p) => !(p.oracle.toLowerCase(), newPrice.oracle.toLowerCase()),
    ),
    newPrice,
  ];
}

export type MedianatorPriceInput = {
  price: OraclePrice;
  oracle: string;
  signature: string;
};

export const ORACLE_PRICE_DECIMALS = 6n;
export const ORACLE_PRICE_DENOMINATOR = 10n ** ORACLE_PRICE_DECIMALS;
export class OraclePrice {
  private constructor(readonly rawUnits: bigint) {}

  static fromRawPrice(rawPrice: ethers.Numeric) {
    return new OraclePrice(ethers.toBigInt(rawPrice));
  }

  static parseUserPrice(price: string): OraclePrice {
    const rawPrice = ethers.parseUnits(price, ORACLE_PRICE_DECIMALS);
    return new OraclePrice(rawPrice);
  }

  invert() {
    const inverted =
      this.rawUnits === 0n
        ? 0n
        : (ORACLE_PRICE_DENOMINATOR * ORACLE_PRICE_DENOMINATOR) / this.rawUnits;
    return new OraclePrice(inverted);
  }

  toExact() {
    return ethers.formatUnits(this.rawUnits, ORACLE_PRICE_DECIMALS);
  }

  format() {
    return this.toExact();
  }
}

class Encoder {
  u = (size: number) => (v: ethers.Numeric | { rawUnits: ethers.Numeric }) => {
    const value = ethers.toNumber(typeof v === "object" ? v.rawUnits : v);
    if (value < 0) {
      throw new SyntaxError(`Expected positive number, got: "${value}"`);
    }
    return `${value}u${size}`;
  };
  u8 = this.u(8);
  u64 = this.u(64);
  bool = (v: boolean): string => (v ? "true" : "false");
  address = (v: string): string => v;
  signature = (v: string): string => v;
  array =
    <T>(encoder: (value: T) => string, length: number, fill: T) =>
    (values: T[]): string => {
      const result = values.concat(Array(length - values.length).fill(fill));
      assert(
        result.length === length,
        "values length should be equal to length",
      );
      return "[" + result.map((v) => encoder(v)).join(", ") + "]";
    };
}
const encode = new Encoder();
