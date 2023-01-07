import {
  PVMFuturesContract,
  PVMFuturesProxyContract,
} from "./../constants/addresses";
import { BigNumber, Contract } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useERC20Approve } from "../../contracts/hooks/useERC20Approve";
import {
  usePVMFuturesAdd2,
  usePVMFuturesBuy2,
  usePVMFuturesSell,
  usePVMFuturesSell2,
  usePVMFuturesSet,
} from "../../contracts/hooks/usePVMFutures";
import {
  usePVMFuturesProxyCancel,
  usePVMFuturesProxyNew,
  usePVMFuturesProxyUpdate,
} from "../../contracts/hooks/usePVMFuturesProxy";
import { tokenList, TokenType } from "../constants/addresses";
import { BASE_2000ETH_AMOUNT, BASE_AMOUNT, ZERO_ADDRESS } from "../utils";
import {
  ERC20Contract,
  NestPriceContract,
  PVMFutures,
  PVMFuturesProxy,
} from "./useContract";
import { MaxUint256 } from "@ethersproject/constants";
import useWeb3 from "./useWeb3";
import useTransactionListCon, { TransactionType } from "./useTransactionInfo";

export type OrderView = {
  index: BigNumber;
  owner: string;
  balance: BigNumber;
  tokenIndex: BigNumber;
  baseBlock: BigNumber;
  lever: BigNumber;
  orientation: boolean;
  basePrice: BigNumber;
  stopPrice: BigNumber;
};
export type LimitOrderView = {
  index: BigNumber;
  owner: string;
  tokenIndex: BigNumber;
  lever: BigNumber;
  orientation: boolean;
  limitPrice: BigNumber;
  stopPrice: BigNumber;
  balance: BigNumber;
  fee: BigNumber;
  stopFee: BigNumber;
  status: BigNumber;
};
export type OldOrderView = {
  index: BigNumber;
  tokenAddress: string;
  lever: BigNumber;
  orientation: boolean;
  balance: BigNumber;
  basePrice: BigNumber;
  baseBlock: BigNumber;
};

const UPDATE_PRICE_TIME = 10;
const UPDATE_LIST_TIME = 10;
const UPDATE_BALANCE_TIME = 60;
const BASE_NEST_FEE = "15";

const tokenArray = [tokenList["ETH"], tokenList["BTC"]];

export function useFutures() {
  const { chainId, account } = useWeb3();
  const [isLong, setIsLong] = useState(true);
  const [nestBalance, setNestBalance] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const [nestAllowance, setNestAllowance] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const [nestAllowance2, setNestAllowance2] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const [limit, setLimit] = useState(false);
  const [stop, setStop] = useState(false);
  const [isPositions, setIsPositions] = useState(true);
  const [nestInput, setNestInput] = useState<string>("");
  const [limitInput, setLimitInput] = useState<string>("");
  const [defaultLimit, setDefaultLimit] = useState<string>("");
  const [takeInput, setTakeInput] = useState<string>("");
  const [leverNum, setLeverNum] = useState<number>(1);
  const [tokenPair, setTokenPair] = useState<string>("ETH");
  const [kValue, setKValue] = useState<{ [key: string]: TokenType }>();
  const [orderList, setOrderList] = useState<Array<OrderView>>([]);
  const [limitOrderList, setLimitOrderList] = useState<Array<LimitOrderView>>(
    []
  );
  const [oldOrderList, setOldOrderList] = useState<Array<OldOrderView>>([]);
  const { pendingList, txList } = useTransactionListCon();
  const nestToken = ERC20Contract(tokenList["NEST"].addresses);

  const priceContract = NestPriceContract();
  const PVMFuturesOJ = PVMFutures();
  const PVMFuturesProxyOJ = PVMFuturesProxy();

  const checkNESTBalance = () => {
    if (nestInput === "") {
      return true;
    }
    return parseUnits(nestInput, 18)
      .add(fee)
      .lte(nestBalance || BigNumber.from("0"));
  };
  const checkAllowance = () => {
    if (!nestInput) {
      return true;
    }
    if (limit) {
      return parseUnits(nestInput, 18).add(fee).lte(nestAllowance2);
    } else {
      return parseUnits(nestInput, 18).add(fee).lte(nestAllowance);
    }
  };
  const orderEmpty = () => {
    if (orderList.length === 0 && oldOrderList.length === 0) {
      return true;
    }
    return false;
  };
  const limitEmpty = () => {
    if (limitOrderList.length === 0) {
      return true;
    }
    return false;
  };

  const getPriceAndK = async (
    contract: Contract,
    leverContract: Contract,
    token: TokenType,
    chainId: number
  ) => {
    const tokenNew = token;
    if (chainId === 56 || chainId === 97) {
      const basePriceList = await leverContract.listPrice(
        token.pairIndex[chainId],
        0,
        1,
        0
      );
      const baseK = parseUnits("0.002", 18);
      tokenNew.k = baseK;
      const priceValue = BASE_2000ETH_AMOUNT.mul(BASE_AMOUNT).div(
        basePriceList[2]
      );
      tokenNew.nowPrice = priceValue;
    } else {
      const priceList = await contract.lastPriceList(
        0,
        token.pairIndex[chainId],
        2
      );
      const priceValue = BASE_2000ETH_AMOUNT.mul(BASE_AMOUNT).div(priceList[1]);
      const k = await leverContract.calcRevisedK(
        token.sigmaSQ,
        BASE_2000ETH_AMOUNT.mul(BASE_AMOUNT).div(priceList[3]),
        priceList[2],
        priceValue,
        priceList[0]
      );
      tokenNew.k = k;
      tokenNew.nowPrice = priceValue;
    }
    return tokenNew;
  };
  const getPrice = useCallback(
    async (contract: Contract, leverContract: Contract, chainId: number) => {
      try {
        const ETH = await getPriceAndK(
          contract,
          leverContract,
          tokenList["ETH"],
          chainId
        );
        const BTC = await getPriceAndK(
          contract,
          leverContract,
          tokenList["BTC"],
          chainId
        );
        const tokenListNew = tokenList;
        tokenListNew["ETH"] = ETH;
        tokenListNew["BTC"] = BTC;
        setKValue(tokenListNew);
      } catch (error) {
        console.log(error);
      }
    },
    []
  );
  const getOrderList = useCallback(async () => {
    try {
      if (!PVMFuturesOJ || !account) {
        return;
      }
      const list: Array<OrderView> = await PVMFuturesOJ.find2(
        "0",
        "500",
        "500",
        account
      );
      const result = list.filter((item) => {
        return item.owner.toLocaleLowerCase() !== ZERO_ADDRESS;
      });
      setOrderList(result);
    } catch (error) {
      console.log(error);
    }
  }, [PVMFuturesOJ, account]);

  const getLimitOrderList = useCallback(async () => {
    try {
      if (!PVMFuturesProxyOJ || !account) {
        return;
      }
      const list: Array<LimitOrderView> = await PVMFuturesProxyOJ.find(
        "0",
        "500",
        "500",
        account
      );
      const result = list.filter((item) => {
        return (
          item.owner.toLocaleLowerCase() !== ZERO_ADDRESS &&
          item.status.toString().toLocaleUpperCase() !== "2"
        );
      });
      setLimitOrderList(result);
    } catch (error) {
      console.log(error);
    }
  }, [PVMFuturesProxyOJ, account]);

  const getOldOrderList = useCallback(async () => {
    try {
      if (!PVMFuturesOJ || !account) {
        return;
      }
      const list: Array<OldOrderView> = await PVMFuturesOJ.find(
        "0",
        "33",
        "33",
        account
      );
      const result = list.filter((item) => {
        return item.balance.toString() !== "0";
      });
      setOldOrderList(result);
    } catch (error) {
      console.log(error);
    }
  }, [PVMFuturesOJ, account]);

  const tokenPrice = useMemo(() => {
    if (!kValue) {
      return {
        tokenName: tokenPair,
        leftIcon: tokenList[tokenPair].Icon,
        price: "---",
      };
    }

    return {
      tokenName: tokenPair,
      leftIcon: tokenList[tokenPair].Icon,
      price: parseFloat(
        formatUnits(kValue[tokenPair].nowPrice!, tokenList["USDT"].decimals)
      )
        .toFixed(2)
        .toString(),
    };
  }, [kValue, tokenPair]);

  const fee = useMemo(() => {
    if (nestInput === "") {
      return BigNumber.from("0");
    }
    const baseFee = parseUnits(nestInput, 18)
      .mul(BigNumber.from(leverNum.toString()))
      .mul(BigNumber.from("2"))
      .div(BigNumber.from("1000"));
    var limitFee = BigNumber.from("0");
    if (limit) {
      limitFee = baseFee;
    }
    return baseFee.add(limitFee).add(parseUnits(BASE_NEST_FEE, 18));
  }, [leverNum, limit, nestInput]);

  const getBalance = useCallback(async () => {
    try {
      if (!nestToken) {
        return;
      }
      const balance = await nestToken.balanceOf(account);
      setNestBalance(balance);
    } catch (error) {
      console.log(error);
    }
  }, [account, nestToken]);
  const getAllowance = useCallback(async () => {
    try {
      if (!nestToken || !chainId) {
        return;
      }
      const allowance1 = await nestToken.allowance(
        account,
        PVMFuturesContract[chainId]
      );
      const allowance2 = await nestToken.allowance(
        account,
        PVMFuturesProxyContract[chainId]
      );
      setNestAllowance(allowance1);
      setNestAllowance2(allowance2);
    } catch (error) {
      console.log(error);
    }
  }, [account, chainId, nestToken]);

  // price
  useEffect(() => {
    if (!priceContract || !chainId || !PVMFuturesOJ) {
      return;
    }
    getPrice(priceContract, PVMFuturesOJ, chainId);
    const time = setInterval(() => {
      getPrice(priceContract, PVMFuturesOJ, chainId);
    }, UPDATE_PRICE_TIME * 1000);
    return () => {
      clearInterval(time);
    };
  }, [chainId, priceContract, PVMFuturesOJ, getPrice, txList]);
  // balance
  useEffect(() => {
    getBalance();
    const time = setInterval(() => {
      getBalance();
    }, UPDATE_BALANCE_TIME * 1000);
    return () => {
      clearInterval(time);
    };
  }, [getBalance]);
  // approve
  useEffect(() => {
    getAllowance();
  }, [getAllowance, txList]);
  // default limit
  useEffect(() => {
    if (tokenPrice && tokenPrice.price === "---") {
      return;
    }
    setDefaultLimit(tokenPrice.price);
  }, [tokenPrice, txList]);
  // list
  useEffect(() => {
    getOrderList();
    getLimitOrderList();
    getOldOrderList();
    const time = setInterval(() => {
      getOrderList();
      getLimitOrderList();
      getOldOrderList();
    }, UPDATE_LIST_TIME * 1000);
    return () => {
      clearInterval(time);
    };
  }, [getLimitOrderList, getOldOrderList, getOrderList]);

  // action
  const buy1 = usePVMFuturesBuy2(
    tokenList[tokenPair],
    BigNumber.from(leverNum.toString()),
    isLong,
    parseUnits(nestInput === "" ? "0" : nestInput, 4),
    parseUnits(takeInput === "" ? "0" : takeInput, 18)
  );
  const buy2 = usePVMFuturesProxyNew(
    tokenList[tokenPair],
    BigNumber.from(leverNum.toString()),
    isLong,
    parseUnits(nestInput === "" ? "0" : nestInput, 4),
    parseUnits(
      limitInput === ""
        ? defaultLimit === ""
          ? "0"
          : defaultLimit
        : limitInput,
      18
    ),
    parseUnits(takeInput === "" ? "0" : takeInput, 18)
  );
  const approveToPVMFutures = useERC20Approve(
    "NEST",
    MaxUint256,
    chainId ? PVMFuturesContract[chainId] : undefined
  );
  const approveToPVMFuturesProxy = useERC20Approve(
    "NEST",
    MaxUint256,
    chainId ? PVMFuturesProxyContract[chainId] : undefined
  );

  // mainButton
  const mainButtonTitle = () => {
    const longOrShort = isLong ? "Long" : "Short";
    return checkAllowance() ? `Open ${longOrShort}` : "Approve";
  };
  const mainButtonDis = () => {
    if (mainButtonLoading()) {
      return true;
    }
    if (!checkAllowance()) {
      return false;
    }
    if (nestInput === "") {
      return true;
    }
  };
  const mainButtonAction = () => {
    if (mainButtonDis()) {
      return;
    }
    if (!checkAllowance()) {
      if (limit) {
        approveToPVMFuturesProxy();
      } else {
        approveToPVMFutures();
      }
      return;
    }
    if (limit) {
      buy2();
    } else {
      buy1();
    }
  };
  const mainButtonLoading = () => {
    const pendingTransaction = pendingList.filter(
      (item) =>
        item.type === TransactionType.buyLever ||
        item.type === TransactionType.approve ||
        item.type === TransactionType.PVMFuturesProxyNew
    );
    return pendingTransaction.length > 0 ? true : false;
  };

  return {
    chainId,
    isLong,
    setIsLong,
    nestBalance,
    limit,
    setLimit,
    stop,
    setStop,
    isPositions,
    setIsPositions,
    nestInput,
    setNestInput,
    leverNum,
    setLeverNum,
    tokenPair,
    setTokenPair,
    limitInput,
    defaultLimit,
    setLimitInput,
    takeInput,
    setTakeInput,
    tokenPrice,
    checkNESTBalance,
    fee,
    mainButtonTitle,
    mainButtonDis,
    mainButtonAction,
    mainButtonLoading,
    orderList,
    limitOrderList,
    oldOrderList,
    kValue,
    orderEmpty,
    limitEmpty,
  };
}

export function useFuturesOrderList(
  order: OrderView,
  kValue?: { [key: string]: TokenType }
) {
  const { chainId } = useWeb3();
  const [marginAssets, setMarginAssets] = useState<BigNumber>();

  const PVMFuturesOJ = PVMFutures();

  const tokenName = useCallback(() => {
    if (!chainId) {
      return;
    }

    const thisToken = tokenArray.filter((item) => {
      return item.pairIndex[chainId] === order.tokenIndex.toString();
    });
    if (thisToken[0].addresses[chainId] === ZERO_ADDRESS) {
      return "ETH";
    }
    return "BTC";
  }, [chainId, order.tokenIndex]);
  const orderValue = useCallback(async () => {
    try {
      if (!tokenName() || !kValue || !PVMFuturesOJ) {
        return;
      }
      const price = kValue[tokenName()!].nowPrice;
      const value = await PVMFuturesOJ.valueOf2(order.index, price);
      setMarginAssets(value);
    } catch (error) {
      console.log(error);
    }
  }, [PVMFuturesOJ, kValue, order.index, tokenName]);

  const showMarginAssets = () => {
    return marginAssets
      ? parseFloat(formatUnits(marginAssets, 18)).toFixed(2).toString()
      : "---";
  };
  const showBalance = () => {
    return parseFloat(formatUnits(order.balance, 4)).toFixed(2).toString();
  };
  const showBasePrice = () => {
    return parseFloat(formatUnits(order.basePrice, 18)).toFixed(2).toString();
  };
  const showTriggerTitle = () => {
    return BigNumber.from("0").eq(order.stopPrice) ? "Trigger" : "Edit";
  };
  const TokenOneSvg = tokenList[tokenName() ?? "ETH"].Icon;
  const TokenTwoSvg = tokenList["USDT"].Icon;

  useEffect(() => {
    orderValue();
  }, [orderValue]);

  return {
    TokenOneSvg,
    TokenTwoSvg,
    showBalance,
    showBasePrice,
    showMarginAssets,
    showTriggerTitle,
  };
}

export function useFuturesOldOrderList(
  order: OldOrderView,
  kValue?: { [key: string]: TokenType }
) {
  const { account } = useWeb3();
  const [marginAssets, setMarginAssets] = useState<BigNumber>();
  const { pendingList } = useTransactionListCon();
  const PVMFuturesOJ = PVMFutures();

  const tokenName = useCallback(() => {
    if (
      order.tokenAddress.toLocaleLowerCase() ===
      ZERO_ADDRESS.toLocaleLowerCase()
    ) {
      return "ETH";
    }
    return "BTC";
  }, [order.tokenAddress]);
  const orderValue = useCallback(async () => {
    try {
      if (!tokenName() || !kValue || !PVMFuturesOJ) {
        return;
      }
      const price = kValue[tokenName()!].nowPrice;
      const value = await PVMFuturesOJ.balanceOf(order.index, price, account);
      setMarginAssets(value);
    } catch (error) {
      console.log(error);
    }
  }, [PVMFuturesOJ, account, kValue, order.index, tokenName]);

  const showMarginAssets = () => {
    return marginAssets
      ? parseFloat(formatUnits(marginAssets, 18)).toFixed(2).toString()
      : "---";
  };
  const showBalance = () => {
    return parseFloat(formatUnits(order.balance, 18)).toFixed(2).toString();
  };
  const showBasePrice = () => {
    return parseFloat(formatUnits(order.basePrice, 18)).toFixed(2).toString();
  };
  const TokenOneSvg = tokenList[tokenName()].Icon;
  const TokenTwoSvg = tokenList["USDT"].Icon;

  useEffect(() => {
    orderValue();
  }, [orderValue]);

  const closeButtonLoading = () => {
    const pendingTransaction = pendingList.filter(
      (item) =>
        item.type === TransactionType.closeLever &&
        item.info === order.index.toString()
    );
    return pendingTransaction.length > 0 ? true : false;
  };
  const closeButtonDis = () => {
    if (closeButtonLoading()) {
      return true;
    }
    return false;
  };
  const closeAction = usePVMFuturesSell(order.index, order.balance);
  const closeButtonAction = () => {
    if (closeButtonDis()) {
      return;
    }
    closeAction();
  };

  return {
    TokenOneSvg,
    TokenTwoSvg,
    showBalance,
    showBasePrice,
    showMarginAssets,
    closeButtonLoading,
    closeButtonDis,
    closeButtonAction,
  };
}

export function useFuturesLimitOrderList(order: LimitOrderView) {
  const { chainId } = useWeb3();
  const { pendingList } = useTransactionListCon();
  const tokenName = useCallback(() => {
    if (!chainId) {
      return;
    }
    const thisToken = tokenArray.filter((item) => {
      return item.pairIndex[chainId] === order.tokenIndex.toString();
    });
    if (thisToken[0].addresses[chainId] === ZERO_ADDRESS) {
      return "ETH";
    }
    return "BTC";
  }, [chainId, order.tokenIndex]);
  const showBalance = () => {
    return parseFloat(formatUnits(order.balance, 4)).toFixed(2).toString();
  };
  const showLimitPrice = () => {
    return parseFloat(formatUnits(order.limitPrice, 18)).toFixed(2).toString();
  };
  const TokenOneSvg = tokenList[tokenName() ?? "ETH"].Icon;
  const TokenTwoSvg = tokenList["USDT"].Icon;

  const closeButtonLoading = () => {
    const pendingTransaction = pendingList.filter(
      (item) =>
        item.type === TransactionType.PVMFuturesProxyCancel &&
        item.info === order.index.toString()
    );
    return pendingTransaction.length > 0 ? true : false;
  };
  const closeButtonDis = () => {
    if (closeButtonLoading()) {
      return true;
    }
    return false;
  };
  const closeAction = usePVMFuturesProxyCancel(order.index);
  const closeButtonAction = () => {
    if (closeButtonDis()) {
      return;
    }
    closeAction();
  };

  return {
    TokenOneSvg,
    TokenTwoSvg,
    showBalance,
    showLimitPrice,
    closeButtonLoading,
    closeButtonDis,
    closeButtonAction,
  };
}

export function useFuturesTrigger(order: OrderView) {
  const [triggerInput, setTriggerInput] = useState<string>("");
  const { pendingList } = useTransactionListCon();
  const showPosition = () => {
    const lever = order.lever.toString();
    const longOrShort = order.orientation ? "Long" : "Short";
    const balance = parseFloat(formatUnits(order.balance, 4))
      .toFixed(2)
      .toString();
    return `${lever}X ${longOrShort} ${balance} NEST`;
  };

  const showOpenPrice = () => {
    return `${parseFloat(formatUnits(order.basePrice, 18))
      .toFixed(2)
      .toString()} USDT`;
  };

  const showTriggerFee = () => {
    const fee = BigNumber.from("2")
      .mul(order.lever)
      .mul(order.balance)
      .div(BigNumber.from("1000"))
      .add(parseUnits(BASE_NEST_FEE, 4));
    return `${parseFloat(formatUnits(fee, 4)).toFixed(2).toString()} NEST`;
  };

  const showTitle = () => {
    return BigNumber.from("0").eq(order.stopPrice)
      ? "Trigger Position"
      : "Edit Position";
  };

  const isEdit = () => {
    return !BigNumber.from("0").eq(order.stopPrice);
  };

  const action = usePVMFuturesSet(
    order.index,
    parseUnits(triggerInput === "" ? "0" : triggerInput, 18)
  );
  const actionClose = usePVMFuturesSet(order.index, parseUnits("0", 18));

  const buttonLoading = () => {
    const pendingTransaction = pendingList.filter(
      (item) => item.type === TransactionType.PVMFuturesEditTrigger
    );
    return pendingTransaction.length > 0 ? true : false;
  };

  const buttonDis = () => {
    if (triggerInput === "" || buttonLoading()) {
      return true;
    }
    return false;
  };

  const buttonAction = () => {
    if (buttonDis()) {
      return;
    }
    action();
  };

  return {
    triggerInput,
    setTriggerInput,
    showPosition,
    showOpenPrice,
    showTriggerFee,
    showTitle,
    actionClose,
    buttonDis,
    buttonLoading,
    buttonAction,
    isEdit,
  };
}

export function useFuturesSetLimitOrder(order: LimitOrderView) {
  const [limitInput, setLimitInput] = useState<string>("");
  const { pendingList } = useTransactionListCon();
  const action = usePVMFuturesProxyUpdate(
    order.index,
    parseUnits(limitInput === "" ? "0" : limitInput, 18)
  );

  const buttonLoading = () => {
    const pendingTransaction = pendingList.filter(
      (item) =>
        item.type === TransactionType.PVMFuturesProxyEdit &&
        item.info === order.index.toString()
    );
    return pendingTransaction.length > 0 ? true : false;
  };

  const buttonDis = () => {
    if (limitInput === "" || buttonLoading()) {
      return true;
    }
    return false;
  };

  const buttonAction = () => {
    if (buttonDis()) {
      return;
    }
    action();
  };
  return { limitInput, setLimitInput, buttonLoading, buttonDis, buttonAction };
}

export function useFuturesAdd(order: OrderView) {
  const { account } = useWeb3();
  const [nestInput, setNestInput] = useState<string>("");
  const [nestBalance, setNestBalance] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const nestToken = ERC20Contract(tokenList["NEST"].addresses);
  const { pendingList } = useTransactionListCon();

  const checkNESTBalance = () => {
    if (nestInput === "") {
      return true;
    }
    return parseUnits(nestInput, 18)
      .add(fee)
      .lte(nestBalance || BigNumber.from("0"));
  };

  const fee = useMemo(() => {
    if (nestInput === "") {
      return BigNumber.from("0");
    }
    const baseFee = parseUnits(nestInput, 18)
      .mul(order.lever)
      .mul(BigNumber.from("2"))
      .div(BigNumber.from("1000"));
    return baseFee;
  }, [nestInput, order.lever]);

  const getBalance = useCallback(async () => {
    try {
      if (!nestToken) {
        return;
      }
      const balance = await nestToken.balanceOf(account);
      setNestBalance(balance);
    } catch (error) {
      console.log(error);
    }
  }, [account, nestToken]);

  // balance
  useEffect(() => {
    getBalance();
    const time = setInterval(() => {
      getBalance();
    }, UPDATE_BALANCE_TIME * 1000);
    return () => {
      clearInterval(time);
    };
  }, [getBalance]);

  const showPosition = () => {
    const lever = order.lever.toString();
    const longOrShort = order.orientation ? "Long" : "Short";
    const balance = parseFloat(formatUnits(order.balance, 4))
      .toFixed(2)
      .toString();
    return `${lever}X ${longOrShort} ${balance} NEST`;
  };

  const showOpenPrice = () => {
    return `${parseFloat(formatUnits(order.basePrice, 18))
      .toFixed(2)
      .toString()} USDT`;
  };

  const showFee = () => {
    return parseFloat(formatUnits(fee, 18)).toFixed(2).toString();
  };

  const action = usePVMFuturesAdd2(
    order.index,
    parseUnits(nestInput === "" ? "0" : nestInput, 4)
  );

  const buttonLoading = () => {
    const pendingTransaction = pendingList.filter(
      (item) =>
        item.type === TransactionType.PVMFuturesAdd &&
        item.info === order.index.toString()
    );
    return pendingTransaction.length > 0 ? true : false;
  };

  const buttonDis = () => {
    if (nestInput === "" || buttonLoading() || !checkNESTBalance()) {
      return true;
    }
    return false;
  };

  const buttonAction = () => {
    if (buttonDis()) {
      return;
    }
    action();
  };

  return {
    nestInput,
    setNestInput,
    nestBalance,
    checkNESTBalance,
    showPosition,
    showOpenPrice,
    showFee,
    buttonLoading,
    buttonDis,
    buttonAction,
  };
}

export function useFuturesCloseOrder(
  order: OrderView,
  kValue?: { [key: string]: TokenType }
) {
  const { chainId } = useWeb3();
  const { pendingList } = useTransactionListCon();
  const showPosition = () => {
    const lever = order.lever.toString();
    const longOrShort = order.orientation ? "Long" : "Short";
    const balance = parseFloat(formatUnits(order.balance, 4))
      .toFixed(2)
      .toString();
    return `${lever}X ${longOrShort} ${balance} NEST`;
  };

  const showClosePrice = () => {
    if (!kValue || !chainId) {
      return "---";
    }
    const thisToken = tokenArray.filter((item) => {
      return item.pairIndex[chainId] === order.tokenIndex.toString();
    });
    return thisToken[0].nowPrice
      ? parseFloat(formatUnits(thisToken[0].nowPrice, 18)).toFixed(2).toString()
      : "---";
  };

  const showFee = () => {
    const fee = BigNumber.from("2")
      .mul(order.lever)
      .mul(order.balance)
      .div(BigNumber.from("1000"));
    return parseFloat(formatUnits(fee, 4)).toFixed(2).toString();
  };

  const action = usePVMFuturesSell2(order.index);
  const buttonLoading = () => {
    const pendingTransaction = pendingList.filter(
      (item) =>
        item.type === TransactionType.closeLever &&
        item.info === order.index.toString()
    );
    return pendingTransaction.length > 0 ? true : false;
  };

  const buttonDis = () => {
    if (buttonLoading()) {
      return true;
    }
    return false;
  };

  const buttonAction = () => {
    if (buttonDis()) {
      return;
    }
    action();
  };

  return {
    showPosition,
    showClosePrice,
    showFee,
    buttonLoading,
    buttonDis,
    buttonAction,
  };
}