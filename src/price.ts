import Decimal from "decimal.js";
import { z } from "zod";
import { ORACLE_PRICE_DECIMALS, OraclePrice } from "./medianatorSdk";

const BTC_SCALING_FACTOR = new Decimal("0.00001");

export class BinancePriceGetter {
  async getPrice() {
    const btcPrice = await this.#getBtcPrice();
    const aleoPrice = new Decimal(btcPrice)
      .mul(BTC_SCALING_FACTOR)
      .toFixed(Number(ORACLE_PRICE_DECIMALS));
    return OraclePrice.parseUserPrice(aleoPrice);
  }

  async #getBtcPrice() {
    try {
      const response = BinancePriceSchema.parse(
        await fetch(
          "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
        ).then(async (res) => {
          if (!res.ok) {
            throw new Error(`Failed to get Binance price: ${await res.text()}`);
          }
          return res.json();
        }),
      );
      return response.price;
    } catch (error) {
      throw new Error(`Failed to get Binance price: ${error}`);
    }
  }
}

const BinancePriceSchema = z.object({
  price: z.string(),
});
