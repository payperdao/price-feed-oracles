program medianator_ajhfoeiufhofoeuhh14.aleo {
    mapping medianator_median: u8 => u64;
    mapping medianator_oracles_checksum: u8 => u128;
    mapping medianator_is_oracle: address => bool;

    transition medianator_set_is_oracle(oracle: address, is_oracle: bool) {
        let oracle_hash: u128 = BHP256::hash_to_u128(oracle);
        return then finalize(oracle, oracle_hash, is_oracle);
    }

    finalize medianator_set_is_oracle(oracle: address, oracle_hash: u128, is_oracle: bool) {
        assert(Mapping::get_or_use(medianator_is_oracle, oracle, false) != is_oracle);
        Mapping::set(medianator_is_oracle, oracle, is_oracle);

        // TODO: check if this is secure
        let checksum: u128 = Mapping::get_or_use(medianator_oracles_checksum, 0u8, 0u128);
        if is_oracle {
            checksum = checksum.add_wrapped(oracle_hash);
        } else {
            checksum = checksum.sub_wrapped(oracle_hash);
        }
        Mapping::set(medianator_oracles_checksum, 0u8, checksum);
    }

    // NOTE: 16 oracles is temporary because of Leo language limitation
    transition medianator_set_median(len: u8, prices: [u64; 16], oracles: [address; 16], signatures: [signature; 16]) {
        let last_price: u64 = prices[0u8];
        let median: u64 = 0u64;
        let oracles_checksum: u128 = 0u128;
        for i: u8 in 0u8..16u8 {
            if i < len {
                let price: u64 = prices[i];
                assert(price >= last_price); // prices should be sorted

                // verify signature
                let oracle: address = oracles[i];
                // TODO: data should include (nonce, price, etc)
                assert(signature::verify(signatures[i], oracle, price));


                /////////////////// NOT SECURE AT ALL ///////////////////
                /////////////////// NOT SECURE AT ALL ///////////////////
                /////////////////// NOT SECURE AT ALL ///////////////////
                /////////////////// NOT SECURE AT ALL ///////////////////
                /////////////////// NOT SECURE AT ALL ///////////////////
                oracles_checksum = oracles_checksum.add_wrapped(BHP256::hash_to_u128(oracle));
                /////////////////// NOT SECURE AT ALL ///////////////////
                /////////////////// NOT SECURE AT ALL ///////////////////
                /////////////////// NOT SECURE AT ALL ///////////////////
                /////////////////// NOT SECURE AT ALL ///////////////////
                /////////////////// NOT SECURE AT ALL ///////////////////

                // median calculation. Can't be done outside of the loop due to Leo language limitations
                if i == len / 2u8 {
                    median = price;
                }

                last_price = price;
            }
        }

        assert(median > 0u64);
        assert(oracles_checksum > 0u128);

        return then finalize(median, oracles_checksum);
    }

    finalize medianator_set_median(median: u64, untrusted_oracles_checksum: u128) {
        assert(untrusted_oracles_checksum == Mapping::get(medianator_oracles_checksum, 0u8));
        Mapping::set(medianator_median, 0u8, median);
    }

    transition medianator_assert_correct_price(untrusted_price: u64) {
        assert(untrusted_price > 0u64);
        return then finalize(untrusted_price);
    }

    finalize medianator_assert_correct_price(untrusted_price: u64) {
        let median: u64 = Mapping::get(medianator_median, 0u8);
        assert(untrusted_price == median);
    }
}
