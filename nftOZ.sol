// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract nftOZ is ERC721, ERC721Enumerable, Ownable {

    uint256 constant public FEE = 0.005 ether;
    uint256 constant public NFT_CAP = 40;

    uint256 public nextTokenId;
    uint256 public totalFeesPaid;
    uint256 public mintedTokens;

    //errors
    error ZeroAmount();
    error NotEnoughFunds();
    error ExcessFunds();
    error NotYourToken();
    error MintingFinished();

    //events
    //(Transfer is emitted by OpenZeppelin on mint, transfer and burn, so
    // the old minted / transfered / burnt events are no longer needed)
    event withdrawn(uint amount);

    // name and symbol go to OpenZeppelin, owner is set by Ownable
    constructor() ERC721("Jude Tokens", "JTK") Ownable(msg.sender) {}

    function mint() public payable returns(address, uint256) {

        if (msg.value < FEE) {revert NotEnoughFunds();}
        if (msg.value > FEE) {revert ExcessFunds();}
        if (mintedTokens >= NFT_CAP) {revert MintingFinished();}

        uint256 newId = nextTokenId;

        // update our own state first, then let OpenZeppelin do the minting
        nextTokenId++;
        mintedTokens += 1;
        totalFeesPaid += msg.value;

        _safeMint(msg.sender, newId);

        return (msg.sender, newId);
    }

    function mintTo(address to) public onlyOwner returns(address, uint256) {

        if (mintedTokens >= NFT_CAP) {revert MintingFinished();}

        uint256 newId = nextTokenId;

        nextTokenId++;
        mintedTokens += 1;

        // OpenZeppelin reverts on address(0), so no ZeroAddress check is needed
        _safeMint(to, newId);

        return (to, newId);
    }

    function renounceOwnership() public view override onlyOwner {
        revert("Renounce disabled");
    }

    // There is no transfer() here on purpose: OpenZeppelin already provides
    // transferFrom(from, to, tokenId) and safeTransferFrom(from, to, tokenId).
    // To send your own token, call transferFrom(yourAddress, to, tokenId).

    // ownerOf(tokenId) and balanceOf(address) are also built in,
    // so seeOwner() and the custom mappings are gone.

    function seeTokens(address _owner) public view returns(address, uint256[] memory) {
        uint256 count = balanceOf(_owner);
        uint256[] memory tokens = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            tokens[i] = tokenOfOwnerByIndex(_owner, i);
        }

        return (_owner, tokens);
    }

    function burn(uint256 _tokenId) public returns(address, uint256) {
        // only the token's owner can burn (approved operators cannot)
        if (ownerOf(_tokenId) != msg.sender) {revert NotYourToken();}

        // removes the token from ownership and from the enumeration list
        _burn(_tokenId);

        return (msg.sender, _tokenId);
    }

    function withdraw() public onlyOwner returns(uint256 _amount) {
        uint256 amount = address(this).balance;

        if(amount == 0) {revert ZeroAmount();}

        (bool success, ) = payable(msg.sender).call{value: amount}('');

        require(success, 'Transfer failed');

        emit withdrawn(amount);

        return (amount);
    }

    // Required by Solidity because ERC721 and ERC721Enumerable both define
    // these. They just pass through to the parents.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

}
