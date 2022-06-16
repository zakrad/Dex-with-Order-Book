
const Dex = artifacts.require("Dex");
const Link = artifacts.require("Link");
const truffleAssert = require("truffle-assertions");

contract("Dex", accounts => {


    it("should throw an error when creating sell market order without adequate token balance", async () => {
        let dex = await Dex.deployed()

        let balance = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))
        assert.equal(balance.toNumber(), 0, "Initial LINK balance is not 0")

        await truffleAssert.reverts(
            dex.createMarketOrder(1, web3.utils.fromUtf8("LINK"), 10)
        )
    })

    it("should throw an error when creating buy market order without adequate ETH balance", async () => {
        let dex = await Dex.deployed()

        let balance = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"))
        assert.equal(balance.toNumber(), 0, "Initial ETH balance is not 0")

        await truffleAssert.reverts(
            dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 10)
        )
    })

    it("Market orders can be submitted even if the order book is empty", async () => {
        let dex = await Dex.deployed()

        await dex.depositEth({ value: 10000 })

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 0)
        assert(orderbook.length == 0, "Buy side Orderbook length is not 0")

        await truffleAssert.passes(
            dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 10)
        )
    })


    it("Market orders should not fill more limit orders than the market order amount", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test")

        await dex.addToken(web3.utils.fromUtf8("LINK"), link.address)

        await link.transfer(accounts[1], 50)
        await link.transfer(accounts[2], 50)
        await link.transfer(accounts[3], 50)


        await link.approve(dex.address, 50, { from: accounts[1] })
        await link.approve(dex.address, 50, { from: accounts[2] })
        await link.approve(dex.address, 50, { from: accounts[3] })

        await link.deposit(50, web3.utils.fromUtf8("LINK"), { from: accounts[1] })
        await link.deposit(50, web3.utils.fromUtf8("LINK"), { from: accounts[2] })
        await link.deposit(50, web3.utils.fromUtf8("LINK"), { from: accounts[3] })

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 300, { from: accounts[1] })
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 400, { from: accounts[2] })
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 500, { from: accounts[3] })

        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 10)

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(orderbook.length == 1, "Sell side orderbook should only have 1 order left")
        assert(orderbook[0].filled == 0, "Sell side orderbook should have 0 filled")

    })

    it("Market orders should be filled until the order book is empty", async () => {
        let dex = await Dex.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(orderbook.length == 1, "Sell side Orderbook should have 1 order left")

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 400, { from: accounts[1] })
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 500, { from: accounts[2] })

        let balanceBefore = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))

        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 50)

        let balanceAfter = await dex.balances(accounts[0], web3.utils.fromUtf8("LINK"))

        assert.equal(balanceBefore + 15, balanceAfter)
    })

    it("The eth balance of the buyer should decrease with the filled amount", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()

        await link.approve(dex.address, 500, { from: accounts[1] })
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 300, { from: account[1] })


        let balanceBefore = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"))
        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 1)
        let balanceAfter = await dex.balances(accounts[0], web3.utils.fromUtf8("ETH"))

        assert.equal(balanceBefore - 300, balanceAfter)
    })
    it("The token balance of the limit order sellers should decrease with filled amounts", async () => {
        let dex = await Dex.deployed()
        let link = await Link.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test")

        await link.approve(dex.address, 500, { from: accounts[2] })
        await dex.deposit(100, web3.utils.fromUtf8("LINK"), { from: account[2] })

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 300, { from: account[1] })
        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 400, { from: account[2] })

        let account1balanceBefore = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"))
        let account2balanceBefore = await dex.balances(accounts[2], web3.utils.fromUtf8("LINK"))

        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 2)

        let account1balanceAfter = await dex.balances(accounts[1], web3.utils.fromUtf8("LINK"))
        let account2balanceAfter = await dex.balances(accounts[2], web3.utils.fromUtf8("LINK"))

        assert.equal(account1balanceBefore - 1, account1balanceAfter)
        assert.equal(account2balanceBefore - 1, account2balanceAfter)
    })

    it("Filled limit orders should be removed from the orderbook", async () => {
        let dex = await Dex.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test")

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 1, 300, { from: account[1] })
        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 1)

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(orderbook.length == 0, "Sell side Orderbook should be empty after trade")
    })

    it("Limit orders filled property should be set correctly after a trade", async () => {
        let dex = await Dex.deployed()

        let orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(orderbook.length == 0, "Sell side Orderbook should be empty at start of test")

        await dex.createLimitOrder(1, web3.utils.fromUtf8("LINK"), 5, 300, { from: account[1] })
        await dex.createMarketOrder(0, web3.utils.fromUtf8("LINK"), 2)

        orderbook = await dex.getOrderBook(web3.utils.fromUtf8("LINK"), 1)
        assert(orderbook[0].filled, 2)
        assert(orderbook[0].amount, 5)
    })
})