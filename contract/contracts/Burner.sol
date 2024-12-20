// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IERC20Burnable is IERC20 {
    function burnFrom(address account, uint256 amount) external;
}

interface USDOracleInterface {
    function latestAnswer() external view returns (uint256);
}

// This contract was developed using `RemBurner` by @brucdarc as a guideline
// See https://github.com/brucdarc/burn-mechanism/blob/83af811e6a31c721d59284735eca939dba23525d/contracts/Remburner.sol
// `RemBurner` was licensed under GPL-3.0
contract Burner is Pausable, Ownable {
    event Burned(address indexed user, address indexed asset, address indexed stablecoin, uint256 burnedAmount, uint256 stablecoinAmount);
    event TokenValueRateUpdated(uint256 oldRate, uint256 newRate, uint256 numStablecoinDecimals);

    uint256 constant PRECISION_FACTOR = 1e18;

    uint256 public minRate; // minimum "exchange rate" the user would get in this round in number of units of stablecoins, for burning some amount of ERC20 tokens that had a market-value of 1.0 USD(T) per unit of token prior to the hack. The value is multiplied by `PRECISION_FACTOR` to accommodate for fractions. For example, if a user holds 1.0 USDC and the current mechanism allows the user to at least get 0.1 (new) stablecoin, the value of `minRate` should therefore be set to 0.1 * `PRECISION_FACTOR` = 1e17
    uint256 public maxRate; // similar to `minRate`, but represents the maximum number of units of stablecoins the user would get in this round
    uint256 public baseRate; // the current base exchange rate, without any bonus based on elapsed time since the last exchange

    uint256 public lastResetTimestamp; // when the last exchange occurred

    address public stablecoin; // the contract address of the new stablecoin which the user would get. The intended value is USDS (at address 0x471f66F75af9238A2FA23bA23862B5957109fB21). Here in comments, we use "new stablecoin" and stablecoin interchangeably most of the time. Sometimes we also use the term referring to some depegged tokens which used to be stablecoins before the hack, but we would explicitly state so and clarify.
    address public stablecoinHolder; // the address of the wallet which holds the stablecoin. The address should approve this contract's address up to a sufficient amount, so that this contract can send the stablecoin on behalf of the `stablecoinHolder` wallet to users
    address public distributionToken; // if set, send this token to users in lieu of stablecoin from stablecoinHolder
    uint256 public distributionTokenValueRate; // The value represents the rate for each 1 fractional unit of stablecoin, how many fractional unit of distributionToken should be sent, multiplied by PRECISION_FACTOR. If distributionToken is WONE (0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a) which has 18-decimals, and the price of WONE is $0.015 per WONE, and stablecoin is USDC, which has 6-decimals, then distributionTokenValueRate should be 1e+18 / 0.015 / 1e+6 * 1e+18 = 6.67e+31. To see that, note the invariant a * (V / C) = b where V is distributionTokenValueRate, C is PRECISION_FACTOR, a is the number of fractional units of stablecoin, and b is the number of fractional units of distributionToken. We know that in the WONE (p = $0.015) and USDC scenario above, 1e+6 * (V / C) = (1 / p) * 1e+18, hence V = (1 / p) * 1e+18 / 1e+6 * C = 1e+12 / p * 1e+18 = ~6.67e+31



    uint256 public resetThresholdAmount; // The number of stablecoins (in fractional-units) cumulatively received by the users to trigger a "reset event". A "reset event" would result in the current exchange rate to be decreased to minRate. When any user burns their ERC20 tokens, they could receive some stablecoins, thereby contribute towards the reset threshold. Note that the current exchange rate linearly decreases proportionally to the ratio of `#stablecoins received by the user / reset threshold` no matter whether the reset threshold is reached. For example, if we want to trigger a reset event at the threshold of 250 USDS (which has 6 decimals), then resetThresholdAmount is 2.5e+8
    uint256 public resetPeriod = 3 hours; // as time elapses after each reset, the exchange rate linearly increases over time, proportional to the ratio of `time elapsed / resetPeriod`

    mapping(address => bool) public allowList; // when `useAllowList` is set to true, only addresses in allowList would be able to burn permitted ERC20 tokens and exchange for stablecoins
    bool public useAllowList = false;

    mapping(address => uint256) public tokenValueRate; // Each key is the address of a permitted ERC20 token. The key's corresponding value is how many fractional-units of the ERC20 token is equivalent to 1 fractional-unit of the stablecoin in market-value at the hack, multiplied by `PRECISION_FACTOR`. Here, a fractional-unit is referring to the a whole unit divided by 10 to the power of decimals of the token, i.e. referring in terms of wei. For example, a unit of USDS is 1e+6 fractional units of USDS, similar to other stable coins. A unit of 1USDC (0x985458E523dB3d53125813eD68c274899e9DfAb4) is 1000000 (1e+6) "fractional units" of 1USDC. Since 1USDC used to be a stablecoin itself, the key should be 0x985458E523dB3d53125813eD68c274899e9DfAb4 and the value should be 1e18 (exactly `PRECISION_FACTOR`). On the other hand, a unit of 1WBTC (0x3095c7557bCb296ccc6e363DE01b760bA031F2d9) is 1e+8 "fractional units" of 1WBTC, and each unit is worth roughly 21502 USDT at the time of the hack, therefore the key-value pair should be (0x3095c7557bCb296ccc6e363DE01b760bA031F2d9, 21502 * (1e+6 / 1e+8) * 1e+18 = 2.1502e+20)

    bool public isShutdown = false;

    uint256 public perUserLimitAmount; // maximum number of stablecoins (in fractional-units) that a user may get
    mapping(address => uint256) public exchangedAmounts; // the cumulative amount of stablecoins (in fractional-units) each user exchanged so far

    uint256 public totalExchanged;
    mapping(address => uint256) public totalBurned;

    struct DistributionTokenStats {
        uint256 distributionTokenValueRate;
        uint256 totalExchangeAmountInStablecoin;
    }

    DistributionTokenStats[] private pastDistributionExchangeAmounts;

    USDOracleInterface public usdOracle;


    modifier onlyAllowedAddresses() {
        require(!useAllowList || allowList[msg.sender], "not on list");
        _;
    }
    modifier onlyWhenActive() {
        require(!isShutdown, "already shutdown");
        _;
    }

    constructor (address _stablecoin, uint256 _maxRate, address[] memory tokenAddresses, uint256[] memory exchangeRates, address _distributionToken, uint256 _distributionTokenValueRate,
        USDOracleInterface _usdOracle) {
        stablecoin = _stablecoin;
        maxRate = _maxRate;
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            tokenValueRate[tokenAddresses[i]] = exchangeRates[i];
        }
        distributionToken = _distributionToken;
        distributionTokenValueRate = _distributionTokenValueRate;
        usdOracle = _usdOracle;
    }


    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setStablecoinHolder(address _stablecoinHolder) external onlyOwner {
        stablecoinHolder = _stablecoinHolder;
    }

    function setParameters(uint256 _minRate, uint256 _resetThresholdAmount, uint256 _resetPeriod, uint256 _perUserLimitAmount) external onlyOwner {
        minRate = _minRate;
        resetThresholdAmount = _resetThresholdAmount;
        resetPeriod = _resetPeriod;
        perUserLimitAmount = _perUserLimitAmount;
        baseRate = _minRate;
        lastResetTimestamp = block.timestamp;
    }

    function updateAllowList(address[] calldata addresses, bool[] calldata allowed, bool _useAllowList) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            allowList[addresses[i]] = allowed[i];
        }
        useAllowList = _useAllowList;
    }

    function getPastDistributionExchangeAmounts() public view returns (DistributionTokenStats[] memory){
        return pastDistributionExchangeAmounts;
    }

    function updateDistributionTokenValueRate(uint256 numStablecoinDecimals) external {
        require(msg.sender == stablecoinHolder, "only stablecoinHolder allowed");
        require(numStablecoinDecimals > 0, "invalid decimal");
        uint256 usdRate = uint256(usdOracle.latestAnswer());
        uint256 oldRate = distributionTokenValueRate;
        DistributionTokenStats memory stats = DistributionTokenStats(oldRate, totalExchanged);
        pastDistributionExchangeAmounts.push(stats);
        distributionTokenValueRate = 1e27 / (10**numStablecoinDecimals) * PRECISION_FACTOR / usdRate;
        emit TokenValueRateUpdated(oldRate, distributionTokenValueRate, numStablecoinDecimals);
    }

    /// See `minRate` for the definition of "exchange rate". This function computes the current exchange rate based on time and the cumulative amount of stablecoins cumulatively received by the users since the last reset event
    /// @return the current exchange rate - note that the rate is multiplied by `PRECISION_FACTOR`
    function getCurrentExchangeRate() public view returns (uint256){
        uint256 timeElapsed = block.timestamp - lastResetTimestamp;
        uint256 rateIncrease = (maxRate - minRate) * timeElapsed / resetPeriod;
        uint256 totalRate = rateIncrease + baseRate;
        return totalRate > maxRate ? maxRate : totalRate;
    }

    /// `_totalAmountExchanged` is the amount of stablecoins (in fractional-units) the user received after burning some permitted ERC20.
    /// @return the new exchange rate, after the user receives _totalAmountExchanged in stablecoin.
    function getNewRateAfterExchange(uint256 _totalAmountExchanged) public view returns (uint256){
        if (_totalAmountExchanged > resetThresholdAmount) {
            return minRate;
        }
        uint256 rateDecreasePercentage = _totalAmountExchanged * PRECISION_FACTOR / resetThresholdAmount;
        uint256 resultRate = getCurrentExchangeRate() - (maxRate - minRate) * rateDecreasePercentage / PRECISION_FACTOR;
        return resultRate;
    }

    function updateRate(uint256 _totalAmountExchanged) internal {
        baseRate = getNewRateAfterExchange(_totalAmountExchanged);
        lastResetTimestamp = block.timestamp;
    }

    function shutdown() external onlyOwner {
        isShutdown = true;
    }

    // @param _asset the ERC20 token contract address, must be under permitted list of ERC20 tokens
    // @param _burnAmount the amount of ERC20 token the user wants to burn in exchange for stablecoin
    // @param _minExchangeRate the lowest exchange rate the user would accept to proceed with burning and exchanging
    function exchange(address _asset, uint256 _burnAmount, uint256 _minExchangeRate, uint256 deadline, bytes memory signature) external onlyAllowedAddresses onlyWhenActive whenNotPaused {
        require(block.timestamp <= deadline, "deadline exceeded");
        string memory message = string.concat("Burn ", Strings.toString(_burnAmount), " of ", Strings.toHexString(_asset), " at ", Strings.toString(_minExchangeRate), " before time ", Strings.toString(deadline));
        bytes32 ethMessageHash = ECDSA.toEthSignedMessageHash(bytes(message));
        address signer = ECDSA.recover(ethMessageHash, signature);
        require(signer == msg.sender, "bad signature");
        uint256 valueRate = tokenValueRate[_asset];
        require(valueRate > 0, "unsupported asset");
        uint256 currentExchangeRate = getCurrentExchangeRate();
        require(currentExchangeRate >= _minExchangeRate, "cannot satisfy rate");
        uint256 assetValueAmount = _burnAmount * valueRate / PRECISION_FACTOR;
        uint256 totalAmountExchanged = assetValueAmount * currentExchangeRate / PRECISION_FACTOR;
        require(exchangedAmounts[msg.sender] + totalAmountExchanged <= perUserLimitAmount, "over user limit");
        updateRate(totalAmountExchanged);
        exchangedAmounts[msg.sender] += totalAmountExchanged;
        totalBurned[_asset] += _burnAmount;
        totalExchanged += totalAmountExchanged;
        // 1BUSD is not IERC20Burnable. Only controller of the token can decreaseSupply
        if (_asset == address(0xE176EBE47d621b984a73036B9DA5d834411ef734)) {
            IERC20(_asset).transferFrom(msg.sender, address(0xdead), _burnAmount);
        } else if (_asset == address(0x34B9aa82D89AE04f0f546Ca5eC9C93eFE1288940)) {
            bool success = IERC20(_asset).transferFrom(msg.sender, address(0xdead), _burnAmount);
            require(success, "cannot transfer tqOne");
        } else {
            IERC20Burnable(_asset).burnFrom(msg.sender, _burnAmount);
        }
        if (distributionToken != address(0)) {
            uint256 distributionTokenAmount = totalAmountExchanged * distributionTokenValueRate / PRECISION_FACTOR;
            IERC20(distributionToken).transferFrom(stablecoinHolder, msg.sender, distributionTokenAmount);
        } else {
            IERC20(stablecoin).transferFrom(stablecoinHolder, msg.sender, totalAmountExchanged);
        }
        emit Burned(msg.sender, _asset, stablecoin, _burnAmount, totalAmountExchanged);
    }

}