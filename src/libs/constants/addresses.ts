import { BigNumber } from "ethers";
import {
  TokenBTC,
  TokenETH,
  TokenFORT,
  TokenNest,
  TokenUSDT,
} from "../../components/Icon";
import { ZERO_ADDRESS } from "../utils";

export type AddressesType = {
  [key: number]: string;
};

export type PairIndexType = {
  [key: number]: string;
}

export type TokenType = {
  symbol: string;
  Icon: typeof TokenETH;
  decimals: number;
  addresses: AddressesType;
  pairIndex: PairIndexType;
  nowPrice?: BigNumber;
  k?: BigNumber;
  sigmaSQ?: BigNumber;
};

export const tokenList: { [key: string]: TokenType } = {
  ETH: {
    symbol: "ETH",
    Icon: TokenETH,
    decimals: 18,
    addresses: {
      56: ZERO_ADDRESS,
      97: ZERO_ADDRESS
    },
    pairIndex: {
      56: '0',
      97: '0'
    },
    sigmaSQ: BigNumber.from('45659142400')
  },
  USDT: {
    symbol: "USDT",
    Icon: TokenUSDT,
    decimals: 18,
    addresses: {
      56: "0x55d398326f99059ff775485246999027b3197955",
      97: "0xDd4A68D8236247BDC159F7C5fF92717AA634cBCc"
    },
    pairIndex: {
      56: '',
      97: ''
    }
  },
  DCU: {
    symbol: "DCU",
    Icon: TokenFORT,
    decimals: 18,
    addresses: {
      56: "0xf56c6eCE0C0d6Fbb9A53282C0DF71dBFaFA933eF",
      97: "0x5Df87aE415206707fd52aDa20a5Eac2Ec70e8dbb"
    },
    pairIndex: {
      56: '',
      97: ''
    }
  },
  BTC: {
    symbol: "BTC",
    Icon: TokenBTC,
    decimals: 18,
    addresses: {
      56: "0x46893c30fBDF3A5818507309c0BDca62eB3e1E6b",
      97: "0xaE73d363Cb4aC97734E07e48B01D0a1FF5D1190B"
    },
    pairIndex: {
      56: '2',
      97: '2'
    },
    sigmaSQ: BigNumber.from('31708924900')
  },
  NEST: {
    symbol: "NEST",
    Icon: TokenNest,
    decimals: 18,
    addresses: {
      56: "0xf43A71e4Da398e5731c9580D11014dE5e8fD0530",
      97: "0x821edD79cc386E56FeC9DA5793b87a3A52373cdE"
    },
    pairIndex: {
      56: '',
      97: ''
    },
    sigmaSQ: BigNumber.from('0')
  },
};

export const PVMOptionContract: AddressesType = {
  56: "0x284935F8C571d054Df98eDA8503ea13cde5fd8Cc",
  97: "0x8bBd5db40F61C628a8F62ba75752227b1BFbF6a8"
};

export const PVMLeverContract: AddressesType = {
  56: "0x8c5052f7747D8Ebc2F069286416b6aE8Ad3Cc149",
  97: "0xb8B5b3CDdC5DA7F4B75Bd4B408389b923962ee98"
};

export const NestPrice: AddressesType = {
  56: "0x09CE0e021195BA2c1CDE62A8B187abf810951540",
  97: "0xF2f9E62f52389EF223f5Fa8b9926e95386935277"
};

export const PVMWinContract : AddressesType = {
  56: '0xf43A71e4Da398e5731c9580D11014dE5e8fD0530',
  97: '0x9AeE80A1df3cA0c5B859d94bCCf16d0440f1691d'
}

export const PVMPayBackContract : AddressesType = {
  56: '0xf43A71e4Da398e5731c9580D11014dE5e8fD0530',
  97: '0x0F1cb2bB372edd39624bf1763FE4830DAFcf9139'
}