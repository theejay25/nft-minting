// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

contract nft {

    address public owner;
    uint256 constant public FEE =   5000000000000000;
    uint256 constant public NFT_CAP = 40;

    string public tokenName = 'Jude Tokens';
    string public tokenSymbol = 'JTK';

    uint256 public tokenId;
    uint256 public totalFeesPaid;
    uint256 public mintedTokens;

    //errors
    error ZeroAmount();
    error ZeroAddress();
    error NotEnoughFunds();
    error NotOwner();
    error NotYourToken();
    error ExcessFunds();
    error MintingFinished();
    
    //events
    event transfered(address indexed from, address to, uint indexed tokenId);
    event minted(address indexed to, uint indexed tokenId);
    event withdrawn(uint amount);
    event burnt(uint tokenId);
    event checkOwner(address indexed, uint256);
    event seeOwnedTokens(address indexed, uint256[]);

    modifier onlyOwner() {
        if(msg.sender != owner) {revert NotOwner();}
        _;
    }

    constructor() {
        owner = msg.sender;
    }


    mapping (uint256 => address) public tokenPosition;
    mapping (address => uint256) public balanceOf;
    mapping (address => uint256[]) public ownedTokens;

    function mint() public payable returns(address, uint256) {
        
        uint256 amount = msg.value;

        if (amount == 0) {revert ZeroAmount();}
        if (amount < FEE) {revert NotEnoughFunds();}
        if (amount > FEE) {revert ExcessFunds();}
        if (mintedTokens == NFT_CAP) {revert MintingFinished();}

        uint _TokenId = tokenId;

        uint256[] storage ids = ownedTokens[msg.sender];

        tokenPosition[_TokenId] = msg.sender;
        balanceOf[msg.sender] += 1;
        ids.push(_TokenId);
        totalFeesPaid += amount;

        tokenId++;
        mintedTokens += 1;

        emit minted(msg.sender, _TokenId);

        return(msg.sender, _TokenId);
        
    }

    //it wont matter if owner pays if owner ends up withdrawing the funds later
    function mintTo(address to) public onlyOwner returns(address, uint256) {

        if (mintedTokens >= NFT_CAP) {revert MintingFinished();}
        if (to == address(0)) {revert ZeroAddress();}

        uint TokenId = tokenId;
        uint[] storage ids = ownedTokens[to];

        tokenPosition[tokenId] = to;
        balanceOf[to] += 1;
        ids.push(TokenId);

        tokenId++;
        mintedTokens += 1;

        emit minted(to, TokenId);

        return(to, TokenId);  

    }

    function transfer(address to, uint256 _tokenId) public returns(address, address, uint256) {
        
        if(tokenPosition[_tokenId] != msg.sender) {revert NotYourToken();}
        if(to == address(0)) {revert ZeroAddress();}

        uint256[] storage ids = ownedTokens[msg.sender];
        uint256[] storage receiversTokenList = ownedTokens[to];

        balanceOf[msg.sender] -= 1;
        balanceOf[to] += 1;
        tokenPosition[_tokenId] = to;

        for(uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == _tokenId) {
                ids[i] = ids[ids.length - 1];   // copy the last item into the gap
                ids.pop();                      // drop the last slot
                break;                          // stop searching
            }
        }

        receiversTokenList.push(_tokenId);

        emit transfered(msg.sender, to, _tokenId);
        return (msg.sender, to, _tokenId);

    }

    function seeOwner(uint256 _tokenId) public returns(address) {
        address _owner = tokenPosition[_tokenId];

        emit checkOwner(_owner, _tokenId);
        return(_owner);
    }   

    function seeTokens(address _owner) public returns(address, uint256[] memory) {
        uint256[] memory tokens = ownedTokens[_owner];

        emit seeOwnedTokens(_owner, tokens);
        return (_owner, tokens);
    }

    function _removeFromOwned(address from, uint256 _tokenId) internal {
        uint256[] storage ids = ownedTokens[from];
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == _tokenId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }
    }

    function burn(uint256 _tokenId) public returns(address, uint){
        if (tokenPosition[_tokenId] != msg.sender) {revert NotYourToken();}

        tokenPosition[_tokenId] = address(0);
        balanceOf[msg.sender] -= 1;
        mintedTokens -= 1;
        _removeFromOwned(msg.sender, _tokenId);

        emit burnt(_tokenId);

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

}

// acc2 0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2 21,22,23,24,25,26,27
// acc3 0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db 28,29,30
// acc4 0x78731D3Ca6b7E34aC0F824c42a7cC18A495cabaB 31,32,33,34,35,36,37,38,39
// owner 0x5B38Da6a701c568545dCfcB03FcB875f56beddC4 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20