import { FC, useRef } from "react";
import Popup from "reactjs-popup";
import { LongIcon, ShortIcon } from "../../../components/Icon";
import MainButton from "../../../components/MainButton";
import { TokenType } from "../../../libs/constants/addresses";
import {
  LimitOrderView,
  OrderView,
  useFuturesLimitOrderList,
  useFuturesOrderList,
} from "../../../libs/hooks/useFutures";
import LimitPrice from "../LimitPrice";
import Trigger from "../Trigger";

type FuturesListProps = {
  item: OrderView;
  key: string;
  className: string;
  kValue?: { [key: string]: TokenType };
};
type FuturesList2Props = {
  item: LimitOrderView;
  key: string;
  className: string;
};

const FuturesList: FC<FuturesListProps> = ({ ...props }) => {
  const modal = useRef<any>();
  const {
    TokenOneSvg,
    TokenTwoSvg,
    showBalance,
    showBasePrice,
    showMarginAssets,
  } = useFuturesOrderList(props.item, props.kValue);

  return (
    <tr key={props.key} className={`${props.className}-table-normal`}>
      <td className={"tokenPair"}>
        <TokenOneSvg />
        <TokenTwoSvg />
      </td>
      <td className={"td-type"}>
        {props.item.orientation ? <LongIcon /> : <ShortIcon />}
        <p className={props.item.orientation ? "red" : "green"}>
          {props.item.orientation ? "Long" : "Short"}
        </p>
      </td>
      <td>{props.item.lever.toString()}X</td>
      <td>{showBalance()} NEST</td>
      <td>{showBasePrice()} USDT</td>
      <td>{showMarginAssets()} NEST</td>
      <td className="button">
        <Popup
          modal
          ref={modal}
          trigger={<button className="fort-button">Add</button>}
        >
          {/* <PerpetualsAdd item={props.item} kValue={props.kValue} /> */}
        </Popup>
        <Popup
          modal
          ref={modal}
          trigger={<button className="fort-button">Edit</button>}
        >
          <Trigger />
        </Popup>
        <MainButton>Close</MainButton>
      </td>
    </tr>
  );
};

export default FuturesList;

export const FuturesList2: FC<FuturesList2Props> = ({ ...props }) => {
  const modal = useRef<any>();
  const { TokenOneSvg, TokenTwoSvg, showBalance, showLimitPrice } =
    useFuturesLimitOrderList(props.item);

  return (
    <tr key={props.key} className={`${props.className}-table-normal`}>
      <td className={"tokenPair"}>
        <TokenOneSvg />
        <TokenTwoSvg />
      </td>
      <td className={"td-type"}>
        {props.item.orientation ? <LongIcon /> : <ShortIcon />}
        <p className={props.item.orientation ? "red" : "green"}>
          {props.item.orientation ? "Long" : "Short"}
        </p>
      </td>
      <td>{props.item.lever.toString()}X</td>
      <td>{showBalance()} NEST</td>
      <td>{showLimitPrice()} USDT</td>
      <td className="button">
        <Popup
          modal
          ref={modal}
          trigger={<button className="fort-button">Edit</button>}
        >
          <LimitPrice />
        </Popup>

        <MainButton>Close</MainButton>
      </td>
    </tr>
  );
};
