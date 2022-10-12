// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FakeUSDS is ERC20, Ownable {
    function decimals() public view override returns (uint8) {
        return 6;
    }

    constructor(uint256 _amount) ERC20("FakeUSDS", "FUSDS") {
        _mint(msg.sender, _amount);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
