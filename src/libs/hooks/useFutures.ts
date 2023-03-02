import { NestTrustFuturesContract } from "./../constants/addresses";
import { BigNumber, Contract } from "ethers";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useERC20Approve } from "../../contracts/hooks/useERC20Approve";
import {
  usePVMFuturesSell,
  usePVMFuturesSell2,
} from "../../contracts/hooks/usePVMFutures";
import { tokenList, TokenType } from "../constants/addresses";
import { ZERO_ADDRESS } from "../utils";
import {
  ERC20Contract,
  NestPriceContract,
  NESTTrustFutures,
  PVMFutures,
} from "./useContract";
import { MaxUint256 } from "@ethersproject/constants";
import useWeb3 from "./useWeb3";
import useTransactionListCon, { TransactionType } from "./useTransactionInfo";
import {
  useTrustFuturesAdd,
  useTrustFuturesBuy,
  useTrustFuturesBuyWithStopOrder,
  useTrustFuturesCancelLimitOrder,
  useTrustFuturesNewStopOrder,
  useTrustFuturesNewTrustOrder,
  useTrustFuturesSell,
  useTrustFuturesUpdateLimitPrice,
  useTrustFuturesUpdateStopPrice,
} from "../../contracts/hooks/useNESTTrustFutures";
import { FuturesShareOrderView } from "../../pages/Dashboard/FuturesList";

export type TrustOrder = {
  index: BigNumber;
  owner: string;
  orderIndex: BigNumber;
  balance: BigNumber;
  fee: BigNumber;
  limitPrice: BigNumber;
  stopProfitPrice: BigNumber;
  stopLossPrice: BigNumber;
  status: BigNumber;
};

export type Futures3OrderView = {
  index: BigNumber;
  owner: BigNumber;
  basePrice: BigNumber;
  balance: BigNumber;
  appends: BigNumber;
  channelIndex: BigNumber;
  lever: BigNumber;
  orientation: boolean;
  Pt: BigInt;
  actualMargin: string;
  baseBlock: BigNumber;
  trustOrder?: TrustOrder;
};

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
  actualMargin: string;
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

const UPDATE_PRICE_TIME = 60;
const UPDATE_LIST_TIME = 15;
const UPDATE_BALANCE_TIME = 60;
const BASE_NEST_FEE = "15";
const MIN_NEST = 50;
const ORDER_GROUP = 10000;

export const tokenArray = [
  tokenList["ETH"],
  tokenList["BTC"],
  tokenList["BNB"],
];

const lipPrice = (
  balance: BigNumber,
  appends: BigNumber,
  lever: BigNumber,
  price: BigNumber,
  orientation: boolean
) => {
  if (
    BigNumber.from("0").eq(BigNumber.from(balance.toString())) ||
    BigNumber.from("0").eq(lever)
  ) {
    return BigNumber.from("0");
  }
  const top = BigNumber.from(balance.toString())
    .add(appends)
    .sub(
      BigNumber.from(balance.toString())
        .mul(lever)
        .mul(BigNumber.from(1))
        .div(BigNumber.from(1000))
    )
    .sub(
      BigNumber.from(balance.toString())
        .mul(lever)
        .mul(BigNumber.from(5))
        .div(BigNumber.from(1000))
    )
    .mul(price);
  const bottom = BigNumber.from(balance.toString()).mul(lever);
  const subPrice = top.div(bottom);
  const result = orientation ? price.sub(subPrice) : price.add(subPrice);
  return BigNumber.from("0").gt(result) ? BigNumber.from("0") : result;
};

// async function getListData<N extends {index:BigNumber, lever:BigNumber}>(
//     contract: Contract,
//     getPart: boolean,
//     account: string,
//     setVoid: (value: React.SetStateAction<N[]>) => void
//   ) {
//     const latestOrder: Array<N> = await contract.list("0", "1", "0");
//     const orderMaxNum = Number(latestOrder[0].index.toString()) + 1;
//     const orderGroupNum = orderMaxNum / ORDER_GROUP;
//     var result: Array<N> = [];
//     for (let i = 0; i < orderGroupNum; i++) {
//       const startNum = i === 0 ? 0 : orderMaxNum - i * ORDER_GROUP;
//       if (i !== 0 && startNum === 0) {
//         return;
//       }
//       const groupList: Array<N> = await contract.find(
//         startNum.toString(),
//         "1000",
//         ORDER_GROUP.toString(),
//         account
//       );
//       const groupResult = groupList.filter((item) => {
//         return item.lever.toString() !== "0";
//       });
//       result = [...result, ...groupResult];
//       if (getPart) {
//         setVoid(result);
//       }
//     }
//     if (!getPart) {
//       setVoid(result);
//     }
//   }

export function useFutures() {
  const { chainId, account } = useWeb3();
  const [isLong, setIsLong] = useState(true);
  const [nestBalance, setNestBalance] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const [nestAllowance, setNestAllowance] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const [limit, setLimit] = useState(false);
  const [stop, setStop] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [showTriggerRisk, setShowTriggerRisk] = useState(false);
  const [isPositions, setIsPositions] = useState(true);
  const [nestInput, setNestInput] = useState<string>("");
  const [limitInput, setLimitInput] = useState<string>("");
  const [stopProfitPriceInput, setStopProfitPriceInput] = useState<string>("");
  const [stopLossPriceInput, setStopLossPriceInput] = useState<string>("");
  const [leverNum, setLeverNum] = useState<number>(2);
  const [tokenPair, setTokenPair] = useState<string>("ETH");
  const [kValue, setKValue] = useState<{ [key: string]: TokenType }>();
  const [order3List, setOrder3List] = useState<Array<Futures3OrderView>>([]);
  const [trustOrder3List, setTrustOrder3List] = useState<Array<TrustOrder>>([]);
  const [plusOrder3List, setPlusOrder3] = useState<Array<Futures3OrderView>>(
    []
  );
  const [orderList, setOrderList] = useState<Array<OrderView>>([]);
  const [limitOrderList, setLimitOrderList] = useState<
    Array<Futures3OrderView>
  >([]);
  const [oldOrderList, setOldOrderList] = useState<Array<OldOrderView>>([]);
  const [closedOrder, setClosedOrder] = useState<Array<Futures3OrderView>>([]);
  const [orderNotShow, setOrderNotShow] = useState<BigNumber[]>([]);
  const { pendingList, txList } = useTransactionListCon();

  const [showOpenPosition, setShowOpenPosition] = useState(false);
  const [showOpenPositionOrder, setShowOpenPositionOrder] =
    useState<Futures3OrderView>();

  const nestToken = ERC20Contract(tokenList["NEST"].addresses);

  const trustFuturesContract = NESTTrustFutures();

  const priceContract = NestPriceContract();
  const PVMFuturesOJ = PVMFutures();

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
    return parseUnits(nestInput, 18).add(fee).lte(nestAllowance);
  };
  const checkShowNotice = () => {
    const isShow = localStorage.getItem("PerpetualsFirst");
    return isShow === "1" ? false : true;
  };
  const orderEmpty = () => {
    if (
      orderList.length === 0 &&
      closedOrder.length === 0 &&
      oldOrderList.length === 0
    ) {
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

  const channelIndex = (tokenName: string) => {
    return tokenArray.map((item) => item.symbol).indexOf(tokenName);
  };

  const getPriceAndK = useCallback(
    async (leverContract: Contract, token: TokenType) => {
      const tokenNew = token;
      const index = channelIndex(token.symbol);
      const basePriceList = await leverContract.lastPrice(index);
      tokenNew.nowPrice = BigNumber.from(basePriceList[2].toString());
      return tokenNew;
    },
    []
  );

  const getPrice = useCallback(
    async (leverContract: Contract) => {
      try {
        const ETH = await getPriceAndK(leverContract, tokenList["ETH"]);
        const BTC = await getPriceAndK(leverContract, tokenList["BTC"]);
        const BNB = await getPriceAndK(leverContract, tokenList["BNB"]);

        const tokenListNew = tokenList;
        tokenListNew["ETH"] = ETH;
        tokenListNew["BTC"] = BTC;
        tokenListNew["BNB"] = BNB;
        setKValue({ ...tokenListNew });
      } catch (error) {
        console.log(error);
      }
    },
    [getPriceAndK]
  );

  const getFutures3List = useCallback(
    async (getPart: boolean = false) => {
      try {
        if (!trustFuturesContract || !account) {
          return;
        }
        const latestOrder: Array<Futures3OrderView> =
          await trustFuturesContract.list("0", "1", "0");
        const orderMaxNum = Number(latestOrder[0].index.toString()) + 1;
        const orderGroupNum = orderMaxNum / ORDER_GROUP;
        var result: Futures3OrderView[] = [];
        for (let i = 0; i < orderGroupNum; i++) {
          const startNum = i === 0 ? 0 : orderMaxNum - i * ORDER_GROUP;
          if (i !== 0 && startNum === 0) {
            return;
          }
          const groupList: Array<Futures3OrderView> =
            await trustFuturesContract.find(
              startNum.toString(),
              "1000",
              ORDER_GROUP.toString(),
              account
            );
          const groupResult = groupList.filter((item) => {
            return item.lever.toString() !== "0";
          });
          result = [...result, ...groupResult];
          if (getPart) {
            setOrder3List(result);
          }
        }
        if (!getPart) {
          setOrder3List(result);
        }
      } catch (error) {
        console.log(error);
      }
    },
    [account, trustFuturesContract]
  );

  const getFutures3TrustList = useCallback(
    async (getPart: boolean = false) => {
      try {
        if (!trustFuturesContract || !account) {
          return;
        }

        const latestOrder: Array<TrustOrder> =
          await trustFuturesContract.listTrustOrder("0", "1", "0");
        const orderMaxNum = Number(latestOrder[0].index.toString()) + 1;
        const orderGroupNum = orderMaxNum / ORDER_GROUP;
        var result: TrustOrder[] = [];
        for (let i = 0; i < orderGroupNum; i++) {
          const startNum = i === 0 ? 0 : orderMaxNum - i * ORDER_GROUP;
          if (i !== 0 && startNum === 0) {
            return;
          }
          const groupList: Array<TrustOrder> =
            await trustFuturesContract.findTrustOrder(
              startNum.toString(),
              "1000",
              ORDER_GROUP.toString(),
              account
            );
          const groupResult = groupList.filter((item) => {
            return (
              item.owner.toString().toLocaleLowerCase() !==
              ZERO_ADDRESS.toLocaleLowerCase()
            );
          });
          result = [...result, ...groupResult];
          if (getPart) {
            setTrustOrder3List(result);
          }
        }
        if (!getPart) {
          setTrustOrder3List(result);
        }
        console.log(result);
      } catch (error) {
        console.log(error);
      }
    },
    [account, trustFuturesContract]
  );
  const getOrderList = useCallback(
    async (getPart: boolean = false) => {
      try {
        if (!PVMFuturesOJ || !account) {
          return;
        }
        const latestOrder: Array<OrderView> = await PVMFuturesOJ.list2(
          "0",
          "1",
          "0"
        );
        const orderMaxNum = Number(latestOrder[0].index.toString()) + 1;
        const orderGroupNum = orderMaxNum / ORDER_GROUP;
        var result: OrderView[] = [];
        for (let i = 0; i < orderGroupNum; i++) {
          const startNum = i === 0 ? 0 : orderMaxNum - i * ORDER_GROUP;
          if (i !== 0 && startNum === 0) {
            return;
          }
          const groupList: Array<OrderView> = await PVMFuturesOJ.find2(
            startNum.toString(),
            "1000",
            ORDER_GROUP.toString(),
            account
          );
          const groupResult = groupList.filter((item) => {
            if (chainId === 56) {
              return item.balance.toString() !== "0";
            } else {
              return (
                item.balance.toString() !== "0" &&
                BigNumber.from("30").lt(item.index)
              );
            }
          });
          result = [...result, ...groupResult];
          if (getPart) {
            setOrderList(result);
          }
        }
        if (!getPart) {
          setOrderList(result);
        }
      } catch (error) {
        console.log(error);
      }
    },
    [PVMFuturesOJ, account, chainId]
  );

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
  const getClosedOrderList = useCallback(async () => {
    try {
      if (!chainId || !account) {
        return;
      }
      const data = await fetch(
        `https://api.nestfi.net/api/order/position/v2/list/${chainId}?address=${account}`
      );
      const data_json = await data.json();
      const list: Array<Futures3OrderView> = data_json["value"]
        .map((item: { [x: string]: any }) => {
          const trustOrder: TrustOrder = {
            limitPrice: BigNumber.from("0"),
            stopProfitPrice: parseUnits(item["sp"].toString(), 18),
            stopLossPrice: parseUnits(item["sl"].toString(), 18),
            index: BigNumber.from("0"),
            owner: "",
            orderIndex: BigNumber.from("0"),
            balance: BigNumber.from("0"),
            fee: BigNumber.from("0"),
            status: BigNumber.from("0"),
          };
          return {
            index: BigNumber.from(item["index"].toString()),
            owner: BigNumber.from(item["owner"].toString()),
            balance: parseUnits(item["balance"].toString(), 4),
            channelIndex: BigNumber.from(item["tokenIndex"].toString()),
            baseBlock: BigNumber.from(item["baseBlock"].toString()),
            lever: BigNumber.from(item["level"].toString()),
            orientation: item["orientation"].toString() === "true",
            basePrice: parseUnits(item["basePrice"].toString(), 18),
            stopPrice: parseUnits(
              item["stopPrice"] ? item["stopPrice"].toString() : "0",
              18
            ),
            appends: BigNumber.from(item["append"].toString()),
            actualMargin: item["actualMargin"],
            trustOrder: trustOrder,
          };
        })
        .filter((item: any) => item.lever.toString() !== "0");
      setClosedOrder(list);
    } catch (error) {
      console.log(error);
    }
  }, [account, chainId]);

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
      .mul(BigNumber.from("1"))
      .div(BigNumber.from("1000"));
    var limitFee = BigNumber.from("0");
    if (limit) {
      limitFee = parseUnits(BASE_NEST_FEE, 18);
    }
    return baseFee.add(limitFee);
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
        NestTrustFuturesContract[chainId]
      );
      setNestAllowance(allowance1);
    } catch (error) {
      console.log(error);
    }
  }, [account, chainId, nestToken]);

  const handleShareOrder = useCallback(async () => {
    // http://localhost:3000/#/futures?position=ETH&12400030&20&true&130000&160000&120000
    const href = window.location.href;
    const inviteCode = href?.split("?position=")[1];
    if (inviteCode && account && inviteCode.length > 0) {
      const orderData = inviteCode.split("&");
      if (orderData.length === 7) {
        const tokenNameArray = tokenArray.map((item) => {
          return item.symbol;
        });
        const tokenIndex = tokenNameArray.indexOf(orderData[0]);
        if (tokenIndex === -1) {
          return;
        }
        const trustOrder: TrustOrder = {
          limitPrice: BigNumber.from(orderData[4]),
          stopProfitPrice: BigNumber.from(orderData[5]),
          stopLossPrice: BigNumber.from(orderData[6]),
          index: BigNumber.from("0"),
          owner: "",
          orderIndex: BigNumber.from("0"),
          balance: BigNumber.from("0"),
          fee: BigNumber.from("0"),
          status: BigNumber.from("0"),
        };
        const order: Futures3OrderView = {
          index: BigNumber.from("0"),
          owner: BigNumber.from("0"),
          balance: BigNumber.from(orderData[1]),
          channelIndex: BigNumber.from(tokenIndex.toString()),
          lever: BigNumber.from(orderData[2]),
          orientation: orderData[3] === "true",
          actualMargin: "",
          trustOrder: trustOrder,
          basePrice: BigNumber.from("0"),
          appends: BigNumber.from("0"),
          baseBlock: BigNumber.from("0"),
          Pt: BigInt(0),
        };
        setShowOpenPositionOrder(order);
        setShowOpenPosition(true);
      }
    }
  }, [account]);

  useEffect(() => {
    const plusOrders = order3List.map((order) => {
      var newOrder = { ...order };
      const trustOrders = trustOrder3List.filter((trust) =>
        BigNumber.from(trust.orderIndex.toString()).eq(order.index)
      );
      if (trustOrders.length > 0) {
        newOrder.trustOrder = trustOrders[0];
      }
      return newOrder;
    });

    const plusOrdersNormal = plusOrders
      .filter(
        (item) =>
          !item.trustOrder ||
          (item.trustOrder && BigNumber.from("0").eq(item.trustOrder.status))
      )
      .filter((item) => item.balance.toString() !== "0");
    const plusOrdersLimit = plusOrders.filter(
      (item) =>
        item.trustOrder && BigNumber.from("1").eq(item.trustOrder.status)
    );
    setPlusOrder3(plusOrdersNormal);
    setLimitOrderList(plusOrdersLimit);
  }, [order3List, trustOrder3List]);

  // price
  useEffect(() => {
    if (!priceContract || !chainId || !trustFuturesContract) {
      return;
    }
    getPrice(trustFuturesContract);
    const time = setInterval(() => {
      getPrice(trustFuturesContract);
    }, UPDATE_PRICE_TIME * 1000);
    return () => {
      clearInterval(time);
    };
  }, [chainId, priceContract, trustFuturesContract, getPrice, txList]);
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
  // list
  useEffect(() => {
    getFutures3List(true);
    getFutures3TrustList(true);
    getOrderList(true);
    getOldOrderList();
    getClosedOrderList();
    const time = setInterval(() => {
      getFutures3List();
      getFutures3TrustList();
      getOrderList();
      getOldOrderList();
      getClosedOrderList();
    }, UPDATE_LIST_TIME * 1000);
    return () => {
      clearInterval(time);
    };
  }, [
    getClosedOrderList,
    getFutures3List,
    getFutures3TrustList,
    getOldOrderList,
    getOrderList,
  ]);

  useEffect(() => {
    handleShareOrder();
  }, [handleShareOrder]);

  // action
  const buy1 = useTrustFuturesBuy(
    BigNumber.from(channelIndex(tokenPair).toString()),
    BigNumber.from(leverNum.toString()),
    isLong,
    parseUnits(nestInput === "" ? "0" : nestInput, 4)
  );
  const buy2 = useTrustFuturesNewTrustOrder(
    BigNumber.from(channelIndex(tokenPair).toString()),
    BigNumber.from(leverNum.toString()),
    isLong,
    parseUnits(nestInput === "" ? "0" : nestInput, 4),
    parseUnits(limitInput === "" ? "0" : limitInput, 18),
    parseUnits(stopProfitPriceInput === "" ? "0" : stopProfitPriceInput, 18),
    parseUnits(stopLossPriceInput === "" ? "0" : stopLossPriceInput, 18)
  );
  const buy3 = useTrustFuturesBuyWithStopOrder(
    BigNumber.from(channelIndex(tokenPair).toString()),
    BigNumber.from(leverNum.toString()),
    isLong,
    parseUnits(nestInput === "" ? "0" : nestInput, 4),
    parseUnits(stopProfitPriceInput === "" ? "0" : stopProfitPriceInput, 18),
    parseUnits(stopLossPriceInput === "" ? "0" : stopLossPriceInput, 18)
  );
  const approveToPVMFutures = useERC20Approve(
    "NEST",
    MaxUint256,
    chainId ? NestTrustFuturesContract[chainId] : undefined
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
    if (nestInput === "" || parseFloat(nestInput) < MIN_NEST) {
      return true;
    }
    if (!checkAllowance()) {
      return false;
    }
    if (limitInput === "" && limit) {
      return true;
    }
    if (stopProfitPriceInput === "" && stopLossPriceInput === "" && stop) {
      return true;
    }
    return false;
  };
  const mainButtonAction = () => {
    if (mainButtonDis()) {
      return;
    }
    if (!checkAllowance()) {
      if (checkShowNotice()) {
        setShowNotice(true);
        return;
      }
      approveToPVMFutures();
      return;
    }
    const triggerRiskModal = localStorage.getItem("TriggerRiskModal");
    if ((limit || stop) && triggerRiskModal !== "1") {
      setShowTriggerRisk(true);
      return;
    }
    baseAction();
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
  const baseAction = () => {
    if (limit) {
      buy2();
    } else {
      if (stop) {
        buy3();
      } else {
        buy1();
      }
    }
  };

  // hide order
  const hideOrder = async (index: BigNumber) => {
    setOrderNotShow([...orderNotShow, index]);
    try {
      await fetch(
        `https://api.nestfi.net/api/order/save/${chainId}?address=${account}&index=${index.toString()}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } catch (error) {
      console.log(error);
    }
  };
  const showClosedOrder = useMemo(() => {
    return closedOrder.filter((item) => {
      return !orderNotShow
        .map((item) => item.toString())
        .includes(item.index.toString());
    });
  }, [closedOrder, orderNotShow]);

  const showLiqPrice = () => {
    if (!kValue) {
      return "---";
    }
    const nowPrice = kValue[tokenPair].nowPrice;
    if (!nowPrice || nestInput === "" || nestInput === "0") {
      return "---";
    }
    const result = lipPrice(
      parseUnits(nestInput === "" ? "0" : nestInput, 4),
      BigNumber.from(0),
      BigNumber.from(leverNum),
      nowPrice,
      isLong
    );
    return parseFloat(formatUnits(result, 18)).toFixed(2).toString();
  };

  const feeHoverText = () => {
    if (!limit && !stop) {
      return ["Position fee = Position*0.1%"];
    } else if (limit && !stop) {
      return ["Position fee = Position*0.1%", "Limit order fee = 15 NEST"];
    } else if (!limit && stop) {
      return [
        "Position fee = Position*0.1%",
        "Stop order fee(after execution) = 15 NEST",
      ];
    } else {
      return [
        "Position fee = Position*0.1%",
        "Limit order fee = 15 NEST",
        "Stop order fee(after execution) = 15 NEST",
      ];
    }
  };
  const showFee = () => {
    if (!limit && stop) {
      return `${parseFloat(
        formatUnits(fee.add(parseUnits(BASE_NEST_FEE, 18)), 18)
      )
        .toFixed(2)
        .toString()}`;
    }
    return parseFloat(formatUnits(fee, 18)).toFixed(2).toString();
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
    setLimitInput,
    stopProfitPriceInput,
    setStopProfitPriceInput,
    stopLossPriceInput,
    setStopLossPriceInput,
    tokenPrice,
    checkNESTBalance,
    fee,
    showFee,
    mainButtonTitle,
    mainButtonDis,
    mainButtonAction,
    mainButtonLoading,
    plusOrder3List,
    orderList,
    limitOrderList,
    oldOrderList,
    kValue,
    orderEmpty,
    limitEmpty,
    showNotice,
    setShowNotice,
    showTriggerRisk,
    setShowTriggerRisk,
    hideOrder,
    showClosedOrder,
    baseAction,
    feeHoverText,
    showOpenPosition,
    setShowOpenPosition,
    showOpenPositionOrder,
    showLiqPrice,
  };
}

export function useFutures3OrderList(
  order: Futures3OrderView,
  kValue?: { [key: string]: TokenType }
) {
  const [marginAssets, setMarginAssets] = useState<BigNumber>();

  const trustFuturesContract = NESTTrustFutures();

  const tokenName = useCallback(() => {
    return tokenArray[Number(order.channelIndex.toString())].symbol;
  }, [order.channelIndex]);
  const orderValue = useCallback(async () => {
    try {
      if (!tokenName() || !kValue || !trustFuturesContract) {
        return;
      }
      const price = kValue[tokenName()!].nowPrice;
      const value = await trustFuturesContract.balanceOf(order.index, price);
      setMarginAssets(value);
    } catch (error) {
      console.log(error);
    }
  }, [trustFuturesContract, kValue, order.index, tokenName]);

  const showMarginAssets = () => {
    const normalOrder = marginAssets
      ? parseFloat(formatUnits(marginAssets, 18)).toFixed(2).toString()
      : "---";
    return order.actualMargin === undefined
      ? normalOrder
      : parseFloat(order.actualMargin).toFixed(2).toString();
  };
  const showBalance = () => {
    return parseFloat(formatUnits(order.balance, 4)).toFixed(2).toString();
  };
  const showBasePrice = () => {
    return parseFloat(formatUnits(order.basePrice, 18)).toFixed(2).toString();
  };
  const showTriggerTitle = () => {
    if (order.trustOrder === undefined) {
      return "Trigger";
    } else {
      if (
        BigNumber.from("0").eq(order.trustOrder.stopLossPrice) &&
        BigNumber.from("0").eq(order.trustOrder.stopProfitPrice)
      ) {
        return "Trigger";
      }
      return "Edit";
    }
  };
  const showPercent = () => {
    if (marginAssets) {
      const marginAssets_num = parseFloat(formatUnits(marginAssets, 18));
      const balance_num = parseFloat(
        formatUnits(
          BigNumber.from(order.balance.toString()).add(order.appends),
          4
        )
      );
      if (marginAssets_num >= balance_num) {
        return +((marginAssets_num - balance_num) * 100) / balance_num;
      } else {
        return -(((balance_num - marginAssets_num) * 100) / balance_num);
      }
    } else {
      return 0;
    }
  };
  const showLiqPrice = () => {
    const result = lipPrice(
      order.balance,
      order.appends,
      order.lever,
      order.basePrice,
      order.orientation
    );
    return parseFloat(formatUnits(result, 18)).toFixed(2).toString();
  };
  const shareOrderData = () => {
    const nowPrice = kValue ? kValue[tokenName()].nowPrice : undefined;
    const tp = order.trustOrder
      ? parseFloat(
          parseFloat(formatUnits(order.trustOrder.stopProfitPrice, 18)).toFixed(
            2
          )
        )
      : 0;
    const sl = order.trustOrder
      ? parseFloat(
          parseFloat(formatUnits(order.trustOrder.stopLossPrice, 18)).toFixed(2)
        )
      : 0;
    const data: FuturesShareOrderView = {
      index: Number(order.index.toString()),
      owner: order.owner.toString(),
      leverage: order.lever.toString() + "X",
      orientation: order.orientation ? "Long" : "Short",
      actualRate: parseFloat(showPercent().toFixed(2)),
      openPrice: parseFloat(
        parseFloat(formatUnits(order.basePrice, 18)).toFixed(2)
      ),
      tokenPair: `${tokenName()}/USDT`,
      actualMargin: parseFloat(showMarginAssets()),
      initialMargin: parseFloat(
        parseFloat(formatUnits(order.balance, 4)).toFixed(2)
      ),
      tp: tp,
      sl: sl,
      lastPrice: nowPrice
        ? parseFloat(parseFloat(formatUnits(nowPrice, 18)).toFixed(2))
        : undefined,
    };
    return data;
  };
  const showStopPrice = () => {
    if (
      order.trustOrder === undefined ||
      (order.trustOrder &&
        BigNumber.from("0").eq(order.trustOrder.stopProfitPrice) &&
        BigNumber.from("0").eq(order.trustOrder.stopLossPrice))
    ) {
      return ["not set"];
    } else if (
      order.trustOrder &&
      BigNumber.from("0").eq(order.trustOrder.stopProfitPrice)
    ) {
      return [
        `SL:${parseFloat(
          formatUnits(order.trustOrder.stopLossPrice, 18)
        ).toFixed(2)} USDT`,
      ];
    } else if (
      order.trustOrder &&
      BigNumber.from("0").eq(order.trustOrder.stopLossPrice)
    ) {
      return [
        `TP:${parseFloat(
          formatUnits(order.trustOrder.stopProfitPrice, 18)
        ).toFixed(2)} USDT`,
      ];
    } else {
      return [
        `TP:${parseFloat(
          formatUnits(order.trustOrder.stopProfitPrice, 18)
        ).toFixed(2)} USDT`,
        `SL:${parseFloat(
          formatUnits(order.trustOrder.stopLossPrice, 18)
        ).toFixed(2)} USDT`,
      ];
    }
  };
  const TokenOneSvg = tokenList[tokenName()].Icon;
  const TokenTwoSvg = tokenList["USDT"].Icon;

  useEffect(() => {
    if (order.actualMargin === undefined) {
      orderValue();
    } else {
      setMarginAssets(parseUnits(order.actualMargin, 4))
    }
  }, [order.actualMargin, orderValue]);

  return {
    TokenOneSvg,
    TokenTwoSvg,
    showBalance,
    showBasePrice,
    showMarginAssets,
    showTriggerTitle,
    showPercent,
    showLiqPrice,
    showStopPrice,
    tokenName,
    shareOrderData,
  };
}

export function useFuturesOrderList(
  order: OrderView,
  kValue?: { [key: string]: TokenType }
) {
  const [marginAssets, setMarginAssets] = useState<BigNumber>();
  const { pendingList } = useTransactionListCon();
  const PVMFuturesOJ = PVMFutures();

  const tokenName = useCallback(() => {
    return tokenArray[Number(order.tokenIndex.toString())].symbol;
  }, [order.tokenIndex]);
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
    const normalOrder = marginAssets
      ? parseFloat(formatUnits(marginAssets, 18)).toFixed(2).toString()
      : "---";
    return order.actualMargin === undefined
      ? normalOrder
      : parseFloat(order.actualMargin).toFixed(2).toString();
  };
  const showBasePrice = () => {
    return parseFloat(formatUnits(order.basePrice, 18)).toFixed(2).toString();
  };
  const showPercent = () => {
    if (marginAssets) {
      const marginAssets_num = parseFloat(formatUnits(marginAssets, 18));
      const balance_num = parseFloat(formatUnits(order.balance, 4));
      if (marginAssets_num >= balance_num) {
        return ((marginAssets_num - balance_num) * 100) / balance_num;
      } else {
        return -(((balance_num - marginAssets_num) * 100) / balance_num);
      }
    } else {
      return 0;
    }
  };

  const showLiqPrice = () => {
    const result = lipPrice(
      order.balance,
      BigNumber.from("0"),
      order.lever,
      order.basePrice,
      order.orientation
    );
    return parseFloat(formatUnits(result, 18)).toFixed(2).toString();
  };
  const showStopPrice = () => {
    if (BigNumber.from("0").eq(order.stopPrice)) {
      return ["not set"];
    }
    return [
      `TRIG:${parseFloat(formatUnits(order.stopPrice, 18).toString()).toFixed(
        2
      )} USDT`,
    ];
  };
  const TokenOneSvg = tokenList[tokenName()].Icon;
  const TokenTwoSvg = tokenList["USDT"].Icon;

  useEffect(() => {
    if (order.actualMargin === undefined) {
      orderValue();
    }
  }, [order.actualMargin, orderValue]);

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
    TokenOneSvg,
    TokenTwoSvg,
    showBasePrice,
    showMarginAssets,
    showPercent,
    showLiqPrice,
    showStopPrice,
    buttonLoading,
    buttonDis,
    buttonAction,
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

  const showPercent = () => {
    if (marginAssets) {
      const marginAssets_num = parseFloat(formatUnits(marginAssets, 18));
      const balance_num = parseFloat(formatUnits(order.balance, 18));
      if (marginAssets_num >= balance_num) {
        return ((marginAssets_num - balance_num) * 100) / balance_num;
      } else {
        return -(((balance_num - marginAssets_num) * 100) / balance_num);
      }
    } else {
      return 0;
    }
  };

  const showLiqPrice = () => {
    var result;
    if (order.orientation) {
      result = order.basePrice.sub(order.basePrice.div(order.lever));
    } else {
      result = order.basePrice.add(order.basePrice.div(order.lever));
    }
    return parseFloat(formatUnits(result, 18)).toFixed(2).toString();
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
    showPercent,
    showLiqPrice,
  };
}

export function useFuturesLimitOrderList(order: Futures3OrderView) {
  const { pendingList } = useTransactionListCon();
  const tokenName = useCallback(() => {
    return tokenArray[Number(order.channelIndex.toString())].symbol;
  }, [order.channelIndex]);
  const showBalance = () => {
    return parseFloat(
      formatUnits(
        order.trustOrder ? order.trustOrder.balance : BigNumber.from("0"),
        4
      )
    )
      .toFixed(2)
      .toString();
  };
  const showLimitPrice = () => {
    return parseFloat(
      formatUnits(
        order.trustOrder ? order.trustOrder.limitPrice : BigNumber.from("0"),
        18
      )
    )
      .toFixed(2)
      .toString();
  };
  const TokenOneSvg = tokenList[tokenName()].Icon;
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
  const closeAction = useTrustFuturesCancelLimitOrder(order.trustOrder!.index);
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

export function useFuturesTrigger(order: Futures3OrderView) {
  const [stopProfitPriceInput, setStopProfitPriceInput] = useState<string>("");
  const [stopLossPriceInput, setStopLossPriceInput] = useState<string>("");
  const [showTriggerRisk, setShowTriggerRisk] = useState(false);
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

  const defaultSp = useCallback(() => {
    if (
      order.trustOrder &&
      !BigNumber.from("0").eq(order.trustOrder.stopProfitPrice)
    ) {
      return parseFloat(
        formatUnits(order.trustOrder.stopProfitPrice, 18)
      ).toFixed(2);
    }
    return "";
  }, [order.trustOrder]);

  const defaultSl = useCallback(() => {
    if (
      order.trustOrder &&
      !BigNumber.from("0").eq(order.trustOrder.stopLossPrice)
    ) {
      return parseFloat(
        formatUnits(order.trustOrder.stopLossPrice, 18)
      ).toFixed(2);
    }
    return "";
  }, [order.trustOrder]);

  useEffect(() => {
    setStopProfitPriceInput(defaultSp());
    setStopLossPriceInput(defaultSl());
  }, [defaultSl, defaultSp]);

  const showTriggerFee = () => {
    const fee = BigNumber.from("1")
      .mul(order.lever)
      .mul(order.balance)
      .div(BigNumber.from("1000"))
      .add(parseUnits(BASE_NEST_FEE, 4));
    return `${parseFloat(formatUnits(fee, 4)).toFixed(2).toString()} NEST`;
  };

  const hadSet = () => {
    if (
      !order.trustOrder ||
      (order.trustOrder &&
        BigNumber.from("0").eq(order.trustOrder.stopProfitPrice) &&
        BigNumber.from("0").eq(order.trustOrder.stopLossPrice))
    ) {
      return false;
    } else {
      return true;
    }
  };

  const showTitle = () => {
    return hadSet() ? "Edit Position" : "Trigger Position";
  };

  const showTPPlaceHolder = () => {
    return `>${showOpenPrice()}`;
  };
  const showSLPlaceHolder = () => {
    return `<${showOpenPrice()}`;
  };

  const showLiqPrice = () => {
    const result = lipPrice(
      order.balance,
      order.appends,
      order.lever,
      order.basePrice,
      order.orientation
    );
    return parseFloat(formatUnits(result, 18)).toFixed(2).toString();
  };

  const isEdit = () => {
    return hadSet();
  };

  const closeProfit = () => {
    return order.trustOrder &&
      !BigNumber.from("0").eq(order.trustOrder.stopProfitPrice)
      ? true
      : false;
  };

  const closeLoss = () => {
    return order.trustOrder &&
      !BigNumber.from("0").eq(order.trustOrder.stopLossPrice)
      ? true
      : false;
  };

  const actionCreate = useTrustFuturesNewStopOrder(
    order.index,
    parseUnits(stopProfitPriceInput === "" ? "0" : stopProfitPriceInput, 18),
    parseUnits(stopLossPriceInput === "" ? "0" : stopLossPriceInput, 18)
  );
  const actionUpdate = useTrustFuturesUpdateStopPrice(
    parseUnits(stopProfitPriceInput === "" ? "0" : stopProfitPriceInput, 18),
    parseUnits(stopLossPriceInput === "" ? "0" : stopLossPriceInput, 18),
    order.trustOrder?.index
  );
  const actionCloseProfit = useTrustFuturesUpdateStopPrice(
    parseUnits("0", 18),
    parseUnits(stopLossPriceInput === "" ? "0" : stopLossPriceInput, 18),
    order.trustOrder?.index
  );
  const actionCloseLoss = useTrustFuturesUpdateStopPrice(
    parseUnits(stopProfitPriceInput === "" ? "0" : stopProfitPriceInput, 18),
    parseUnits("0", 18),
    order.trustOrder?.index
  );
  const buttonLoading = () => {
    const pendingTransaction = pendingList.filter(
      (item) => item.type === TransactionType.PVMFuturesEditTrigger
    );
    return pendingTransaction.length > 0 ? true : false;
  };

  const buttonDis = () => {
    if (buttonLoading()) {
      return true;
    }
    const sp = stopProfitPriceInput === "" ? "0" : stopProfitPriceInput;
    const sl = stopLossPriceInput === "" ? "0" : stopLossPriceInput;
    if (
      BigNumber.from("0").eq(parseUnits(sp, 18)) &&
      BigNumber.from("0").eq(parseUnits(sl, 18))
    ) {
      return true;
    }
    return false;
  };

  const buttonAction = () => {
    if (buttonDis()) {
      return;
    }
    const triggerRiskModal = localStorage.getItem("TriggerRiskModal");
    if (triggerRiskModal !== "1") {
      setShowTriggerRisk(true);
      return;
    }
    if (order.trustOrder) {
      actionUpdate();
    } else {
      actionCreate();
    }
  };

  const baseAction = () => {
    if (order.trustOrder) {
      actionUpdate();
    } else {
      actionCreate();
    }
  };

  return {
    stopProfitPriceInput,
    setStopProfitPriceInput,
    stopLossPriceInput,
    setStopLossPriceInput,
    showPosition,
    showOpenPrice,
    showTriggerFee,
    showTitle,
    actionCloseProfit,
    actionCloseLoss,
    buttonDis,
    buttonLoading,
    buttonAction,
    isEdit,
    showTPPlaceHolder,
    showSLPlaceHolder,
    showTriggerRisk,
    setShowTriggerRisk,
    baseAction,
    showLiqPrice,
    closeProfit,
    closeLoss,
  };
}

export function useFuturesSetLimitOrder(order: Futures3OrderView) {
  const [limitInput, setLimitInput] = useState<string>("");
  const { pendingList } = useTransactionListCon();
  const action = useTrustFuturesUpdateLimitPrice(
    order.trustOrder!.index,
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

  const showPlaceHolder = () => {
    return parseFloat(
      formatUnits(
        order.trustOrder ? order.trustOrder.limitPrice : BigNumber.from("0"),
        18
      )
    )
      .toFixed(2)
      .toString();
  };
  return {
    limitInput,
    setLimitInput,
    buttonLoading,
    buttonDis,
    buttonAction,
    showPlaceHolder,
  };
}

export function useFuturesAdd(order: Futures3OrderView) {
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
    return parseUnits(nestInput, 18).lte(nestBalance || BigNumber.from("0"));
  };

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
    return `${parseFloat(formatUnits(newBasePrice(), 18))
      .toFixed(2)
      .toString()} USDT`;
  };

  const showLiqPrice = () => {
    const result = lipPrice(
      order.balance,
      parseUnits(nestInput === "" ? "0" : nestInput, 4),
      order.lever,
      order.basePrice,
      order.orientation
    );
    return parseFloat(formatUnits(result, 18)).toFixed(2).toString();
  };

  const newBasePrice = () => {
    return order.basePrice;
  };

  const action = useTrustFuturesAdd(
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
    if (
      nestInput === "" ||
      buttonLoading() ||
      !checkNESTBalance() ||
      parseFloat(nestInput) < 0.0001
    ) {
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
    showLiqPrice,
    buttonLoading,
    buttonDis,
    buttonAction,
  };
}

export function useFuturesCloseOrder(
  order: Futures3OrderView,
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
    const thisToken = tokenArray[Number(order.channelIndex.toString())];
    return thisToken.nowPrice
      ? parseFloat(formatUnits(thisToken.nowPrice, 18)).toFixed(2).toString()
      : "---";
  };

  const showFee = () => {
    if (!chainId) {
      return "---";
    }
    const thisToken = tokenArray[Number(order.channelIndex.toString())];
    if (!thisToken.nowPrice) {
      return "---";
    }
    const fee = BigNumber.from("1")
      .mul(order.lever)
      .mul(order.balance)
      .mul(thisToken.nowPrice)
      .div(BigNumber.from("1000").mul(order.basePrice));
    return parseFloat(formatUnits(fee, 4)).toFixed(2).toString();
  };

  const action = useTrustFuturesSell(order.index);
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

export function useFuturesOpenPosition(order: Futures3OrderView) {
  const [nestAmount, setNestAmount] = useState<string>("");
  const [nowPrice, setNowPrice] = useState<BigNumber>();
  const [limit, setLimit] = useState<string>("");
  const [tp, setTp] = useState<string>("");
  const [sl, setSl] = useState<string>("");
  const [nestBalance, setNestBalance] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const [nestAllowance, setNestAllowance] = useState<BigNumber>(
    BigNumber.from("0")
  );
  const { chainId, account } = useWeb3();
  const { pendingList } = useTransactionListCon();

  const nestToken = ERC20Contract(tokenList["NEST"].addresses);
  const trustFuturesContract = NESTTrustFutures();

  const checkNESTBalance = () => {
    if (nestAmount === "") {
      return true;
    }
    return parseUnits(nestAmount, 18)
      .add(fee)
      .lte(nestBalance || BigNumber.from("0"));
  };
  const checkAllowance = () => {
    if (!nestAmount) {
      return true;
    }
    return parseUnits(nestAmount, 18).add(fee).lte(nestAllowance);
  };
  const fee = useMemo(() => {
    if (nestAmount === "") {
      return BigNumber.from("0");
    }
    const baseFee = parseUnits(nestAmount, 18)
      .mul(BigNumber.from(order.lever.toString()))
      .mul(BigNumber.from("2"))
      .div(BigNumber.from("1000"));
    var limitFee = BigNumber.from("0");
    if (limit) {
      limitFee = parseUnits(BASE_NEST_FEE, 18);
    }
    return baseFee.add(limitFee);
  }, [limit, nestAmount, order.lever]);

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
        NestTrustFuturesContract[chainId]
      );
      setNestAllowance(allowance1);
    } catch (error) {
      console.log(error);
    }
  }, [account, chainId, nestToken]);

  const getPrice = useCallback(
    async (leverContract: Contract, channelIndex: BigNumber) => {
      try {
        const basePriceList = await leverContract.lastPrice(channelIndex);
        setNowPrice(BigNumber.from(basePriceList[2].toString()));
      } catch (error) {
        console.log(error);
      }
    },
    []
  );
  useEffect(() => {
    if (!chainId || !trustFuturesContract) {
      return;
    }
    getPrice(trustFuturesContract, order.channelIndex);
    const time = setInterval(() => {
      getPrice(trustFuturesContract, order.channelIndex);
    }, UPDATE_PRICE_TIME * 1000);
    return () => {
      clearInterval(time);
    };
  }, [chainId, getPrice, order.channelIndex, trustFuturesContract]);

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
  }, [getAllowance]);

  useEffect(() => {
    setNestAmount(formatUnits(order.balance, 4));
    setLimit(formatUnits(order.trustOrder!.limitPrice, 2));
    setTp(formatUnits(order.trustOrder!.stopProfitPrice, 2));
    setSl(formatUnits(order.trustOrder!.stopLossPrice, 2));
  }, [order.balance, order.basePrice, order.trustOrder]);

  const showPosition = () => {
    const tokenName = tokenArray[Number(order.channelIndex.toString())];
    const LS = order.orientation ? "Long" : "Short";
    const lever = order.lever.toString();
    return `${tokenName.symbol}/USDT ${lever}X ${LS}`;
  };

  const approveToPVMFutures = useERC20Approve(
    "NEST",
    MaxUint256,
    chainId ? NestTrustFuturesContract[chainId] : undefined
  );

  const buy2 = useTrustFuturesNewTrustOrder(
    order.channelIndex,
    order.lever,
    order.orientation,
    parseUnits(nestAmount === "" ? "0" : nestAmount, 4),
    parseUnits(limit === "" ? "0" : limit, 18),
    parseUnits(tp === "" ? "0" : tp, 18),
    parseUnits(sl === "" ? "0" : sl, 18)
  );

  // mainButton
  const mainButtonTitle = () => {
    const longOrShort = order.orientation ? "Long" : "Short";
    return checkAllowance() ? `Open ${longOrShort}` : "Approve";
  };
  const mainButtonDis = () => {
    if (mainButtonLoading()) {
      return true;
    }
    if (nestAmount === "" || parseFloat(nestAmount) < MIN_NEST) {
      return true;
    }
    if (!checkAllowance()) {
      return false;
    }
    if (limit === "") {
      return true;
    }
    return false;
  };
  const mainButtonAction = () => {
    if (mainButtonDis()) {
      return;
    }
    if (!checkAllowance()) {
      approveToPVMFutures();
      return;
    }
    buy2();
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

  const showNowPrice = () => {
    if (!nowPrice) {
      return "---";
    }
    return parseFloat(formatUnits(nowPrice, 18)).toFixed(2);
  };

  const showLiqPrice = () => {
    if (!nowPrice || nestAmount === "" || nestAmount === "0") {
      return "---";
    }
    const result = lipPrice(
      parseUnits(nestAmount === "" ? "0" : nestAmount, 4),
      BigNumber.from(0),
      BigNumber.from(order.lever),
      nowPrice,
      order.orientation
    );
    return parseFloat(formatUnits(result, 18)).toFixed(2).toString();
  };

  const feeHoverText = () => {
    return [
      "Position fee = Position*0.1%",
      "Limit order fee = 15 NEST",
      "Stop order fee(after execution) = 15 NEST",
    ];
  };
  const showFee = () => {
    return parseFloat(formatUnits(fee, 18)).toFixed(2).toString();
  };
  const showTotalPay = () => {
    return parseFloat(
      formatUnits(
        fee.add(parseUnits(nestAmount === "" ? "0" : nestAmount, 18)),
        18
      )
    )
      .toFixed(2)
      .toString();
  };

  return {
    nestAmount,
    setNestAmount,
    limit,
    setLimit,
    tp,
    setTp,
    sl,
    setSl,
    showPosition,
    mainButtonTitle,
    mainButtonDis,
    mainButtonAction,
    mainButtonLoading,
    feeHoverText,
    showNowPrice,
    showLiqPrice,
    showFee,
    showTotalPay,
    checkNESTBalance,
  };
}
