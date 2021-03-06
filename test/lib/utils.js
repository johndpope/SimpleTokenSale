const Moment = require('moment')
const BigNumber = require('bignumber.js')
const SolidityEvent = require("web3/lib/web3/event.js")

var SimpleToken = artifacts.require("./SimpleToken.sol")
var Trustee     = artifacts.require("./Trustee.sol")
var TokenSale   = artifacts.require("./TokenSale.sol")


module.exports.deployContracts = async (artifacts, accounts) => {

   var SimpleToken = artifacts.require("./SimpleToken.sol")
   var Trustee     = artifacts.require("./Trustee.sol")
   //var TokenSale   = artifacts.require("./TokenSale.sol")
   var TokenSaleMock   = artifacts.require("./TokenSaleMock.sol")

   const token     = await SimpleToken.new()
   const trustee   = await Trustee.new(token.address, { from: accounts[0], gas: 3500000 })
   //const sale      = await TokenSale.new(token.address, trustee.address, accounts[0], { from: accounts[0], gas: 4500000 })
   const sale      = await TokenSaleMock.new(token.address, trustee.address, accounts[0], Moment().unix(), { from: accounts[0], gas: 4500000 })

   await token.setOperationsAddress(sale.address)
   await trustee.setOperationsAddress(sale.address)

   const TOKENS_MAX    = await sale.TOKENS_MAX.call()
   const TOKENS_SALE   = await sale.TOKENS_SALE.call()
   const TOKENS_FUTURE = await sale.TOKENS_FUTURE.call()

   const trusteeTokens = TOKENS_MAX.sub(TOKENS_SALE).sub(TOKENS_FUTURE)

   await token.transfer(sale.address, TOKENS_SALE, { from: accounts[0] })
   await token.transfer(trustee.address, trusteeTokens, { from: accounts[0] })

   await sale.initialize({ from: accounts[0] })

   return {
      token   : token,
      trustee : trustee,
      sale    : sale
   }
}


module.exports.deployTrustee = async (artifacts, accounts) => {

   var SimpleToken = artifacts.require("./SimpleToken.sol")
   var Trustee     = artifacts.require("./Trustee.sol")

   const token     = await SimpleToken.new()
   const trustee   = await Trustee.new(token.address, { from: accounts[0], gas: 3500000 })

   return {
      token   : token,
      trustee : trustee
   }
}


module.exports.changeTime = async (sale, newTime) => {
   await sale.changeTime(newTime)
};


module.exports.expectNoEvents = (result) => {
   assert.equal(result.receipt.logs.length, 0, "expected empty array of logs")
}


module.exports.checkTransferEventGroup = (result, _from, _to, _value) => {
   assert.equal(result.logs.length, 1)

   const event = result.logs[0]

   module.exports.checkTransferEvent(event, _from, _to, _value)
}


module.exports.checkTransferEvent = (event, _from, _to, _value) => {
   if (Number.isInteger(_value)) {
      _value = new BigNumber(_value)
   }

   assert.equal(event.event, "Transfer")
   assert.equal(event.args._from, _from)
   assert.equal(event.args._to, _to)
   assert.equal(event.args._value.toNumber(), _value.toNumber())
}


module.exports.checkApprovalEventGroup = (result, _owner, _spender, _value) => {
   assert.equal(result.logs.length, 1)

   const event = result.logs[0]

   if (Number.isInteger(_value)) {
      _value = new BigNumber(_value)
   }

   assert.equal(event.event, "Approval")
   assert.equal(event.args._owner, _owner)
   assert.equal(event.args._spender, _spender)
   assert.equal(event.args._value.toNumber(), _value.toNumber())
}


module.exports.checkWhitelistUpdatedEventGroup = (result, _account, _phase) => {
   assert.equal(result.receipt.logs.length, 1)

   const logs = decodeLogs(TokenSale.abi, [ result.receipt.logs[0] ])

   assert.equal(logs.length, 1)

   assert.equal(logs[0].event, "WhitelistUpdated")
   assert.equal(logs[0].args._account, _account)
   assert.equal(logs[0].args._phase, _phase)
}


module.exports.checkTokensPurchasedEventGroup = (result, _from, _beneficiary, _cost, _tokens) => {

   assert.equal(result.receipt.logs.length, 2)

   var logs = {}

   logs.transfer = decodeLogs(SimpleToken.abi, [ result.receipt.logs[0] ])
   assert.equal(logs.transfer.length, 1)

   if (Number.isInteger(_tokens)) {
      _tokens = new BigNumber(_tokens)
   }

   module.exports.checkTransferEvent(logs.transfer[0], _from, _beneficiary, _tokens)

   logs.tokensPurchased = decodeLogs(TokenSale.abi, [ result.receipt.logs[1] ])
   assert.equal(logs.tokensPurchased.length, 1)

   if (Number.isInteger(_cost)) {
      _cost = new BigNumber(_cost)
   }

   assert.equal(logs.tokensPurchased[0].event, "TokensPurchased")
   assert.equal(logs.tokensPurchased[0].args._beneficiary, _beneficiary)
   assert.equal(logs.tokensPurchased[0].args._cost.toNumber(), _cost.toNumber())
   assert.equal(logs.tokensPurchased[0].args._tokens.toNumber(), _tokens.toNumber())
}


module.exports.checkWalletChangedEventGroup = (result, _newWallet) => {
   assert.equal(result.logs.length, 1)

   const event = result.logs[0]

   assert.equal(event.event, "WalletChanged")
   assert.equal(event.args._newWallet, _newWallet)
}


module.exports.checkPresaleAddedEventGroup = (result, _account, _baseTokens, _bonusTokens) => {
   assert.equal(result.logs.length, 1)

   const event = result.logs[0]

   if (Number.isInteger(_baseTokens)) {
      _baseTokens = new BigNumber(_baseTokens)
   }

   if (Number.isInteger(_bonusTokens)) {
      _bonusTokens = new BigNumber(_bonusTokens)
   }

   assert.equal(event.event, "PresaleAdded")
   assert.equal(event.args._account, _account)
   assert.equal(event.args._baseTokens.toNumber(), _baseTokens.toNumber())
   assert.equal(event.args._bonusTokens.toNumber(), _bonusTokens.toNumber())
}


module.exports.checkTokensReclaimedEventGroup = (result, _amount) => {
   assert.equal(result.logs.length, 1)

   const event = result.logs[0]

   if (Number.isInteger(_amount)) {
      _amount = new BigNumber(_amount)
   }

   assert.equal(event.event, "TokensReclaimed")
   assert.equal(event.args._amount.toNumber(), _amount.toNumber())
}


module.exports.checkFinalizedEventGroup = (result) => {
   assert.equal(result.logs.length, 1)

   const event = result.logs[0]

   assert.equal(event.event, "Finalized")
}


module.exports.expectThrow = async (promise) => {
    try {
        await promise;
    } catch (error) {
        const invalidOpcode = error.message.search('invalid opcode') > -1;

        const outOfGas = error.message.search('out of gas') > -1;

        assert(invalidOpcode || outOfGas, `Expected throw, but got ${error} instead`);

        return;
    }

    assert(false, "Did not throw as expected");
};


module.exports.getBalance = function (address) {
  return new Promise (function (resolve, reject) {
    web3.eth.getBalance(address, function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    })
  })
}


module.exports.getGasPrice = function () {
  return new Promise (function (resolve, reject) {
    web3.eth.getGasPrice(function (error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    })
  })
}


module.exports.calculateTokensFromWei = function (tokensPerKEther, weiAmount) {
   return weiAmount.mul(tokensPerKEther).div(1000)
}

module.exports.calculateCostFromTokens = function (tokensPerKEther, tokenAmount) {
   return tokenAmount.mul(1000).div(tokensPerKEther)
}



function decodeLogs(abi, logs) {
   var decodedLogs = null
   try {
      decodedLogs = decodeLogsInternal(abi, logs)
   } catch(error) {
      throw new 'Could not decode receipt log for transaction ' + txID + ', message: ' + error
   }

   return decodedLogs
}


function decodeLogsInternal(abi, logs) {

   // Find events in the ABI
   var abiEvents = abi.filter(json => {
      return json.type === 'event'
   })

   if (abiEvents.length === 0) {
      return
   }

   // Build SolidityEvent objects
   var solidityEvents = []
   for (i = 0; i < abiEvents.length; i++) {
      solidityEvents.push(new SolidityEvent(null, abiEvents[i], null))
   }

   // Decode each log entry
   var decodedLogs = []
   for (i = 0; i < logs.length; i++) {

      var event = null
      for (j = 0; j < solidityEvents.length; j++) {
         if (solidityEvents[j].signature() == logs[i].topics[0].replace("0x", "")) {
            event = solidityEvents[j]
            break
         }
      }

      var decodedLog = null

      if (event != null) {
         decodedLog = event.decode(logs[i])
      } else {
         // We could not find the right event to decode this log entry, just keep as is.
         decodedLog = logs[i]
      }

      // Convert bytes32 parameters to ascii
      for (j = 0; j < abiEvents.length; j++) {
         const abiEvent = abiEvents[j]

         if (!abiEvent.inputs) {
            continue
         }

         if (abiEvent.name != decodedLog.name) {
            continue
         }

         for (k = 0; k < abiEvent.inputs; k++) {
            if (abiEvent.inputs[k].type == 'bytes32') {
               decodedLog.args[abiEvent.inputs[k].name] = hexToAscii(decodedLog.args[abiEvent.inputs[k]]);
            }
         }
      }

      decodedLogs.push(decodedLog)
   }

   return decodedLogs
}


function hexToAscii(hexStr) {
    var asciiStr = ''

    var start = (hex.substring(0, 2) === '0x') ? 2 : 0

    for (i = start; i < hexStr.length; i += 2) {
        var charCode = parseInt(hex.substr(i, 2), 16)

        if (code === 0) {
           continue
        }

        asciiStr += String.fromCharCode(code);
    }

    return asciiStr;
}

