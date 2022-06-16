// SPDX-License-Identifier: MIT

pragma solidity 0.8.8;
pragma experimental ABIEncoderV2;

contract Dex is Wallet{
    
    enum Side{
        BUY,
        SELL,
    }

    struct Order {
        uint id;
        address trader;
        bool buyOrder;
        bytes32 ticker;
        uint amount;
        uint price;
    }

    mapping(bytes32 => mapping(uint => Order[]));

    function getOrderBook(bytes32 ticker, Side side) view public returns(Order[] memory) {
        return orderBook[ticker][uint(side)]
    }

    function createLimitOrder(){
        
    }
}

