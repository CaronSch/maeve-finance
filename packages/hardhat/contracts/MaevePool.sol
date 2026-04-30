// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Maeve Finance — Lender-defined collateral lending pool
// HACKATHON BUILD: Not audited. Shortcuts documented inline.

import "@openzeppelin/contracts/access/Ownable.sol";

contract MaevePool is Ownable {
    // --- Core data structures ---

    // A lender's deposit into a specific token pool
    struct Deposit {
        uint256 amount;
        uint256 depositTimestamp;
        // SHORTCUT: Interest is calculated on withdraw, not accrued continuously.
        // A real protocol would use share tokens or ray-math accumulator.
    }

    // A lender's collateral preference for their deposit
    // "I'm depositing USDC but I only want ETH or WBTC backing loans against it"
    struct CollateralPreference {
        address collateralToken; // the token the lender will accept as collateral
        uint256 maxLTV;          // basis points, e.g. 7500 = 75% LTV
        bool    active;          // can be toggled off without withdrawing
    }

    // A borrower's open loan
    struct Loan {
        address borrower;
        address borrowToken;     // what they borrowed
        uint256 borrowAmount;
        address collateralToken; // what they locked
        uint256 collateralAmount;
        uint256 borrowTimestamp;
        bool    active;
    }

    // --- Storage ---

    // token => lender => Deposit
    mapping(address => mapping(address => Deposit)) public deposits;

    // token => lender => collateral token => CollateralPreference
    mapping(address => mapping(address => mapping(address => CollateralPreference))) public collateralPrefs;

    // loanId => Loan
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;

    // Track total liquidity available per token (SHORTCUT: simple counter, not share-based)
    mapping(address => uint256) public totalDeposited;
    mapping(address => uint256) public totalBorrowed;

    // SHORTCUT: Flat interest rate per token, owner-set. Real protocol = utilization curve.
    mapping(address => uint256) public interestRateBps; // basis points per year

    // Whitelisted tokens (hackathon scope control)
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    // Default rate applied when a token is whitelisted without an explicit rate.
    uint256 public defaultInterestRateBps;

    constructor(address _owner) Ownable(_owner) {
        defaultInterestRateBps = 500; // 5%
    }

    // --- Admin: token whitelist (no lending logic yet) ---

    function addSupportedToken(address token, uint256 rateBps) external onlyOwner {
        require(token != address(0), "zero token");
        require(!supportedTokens[token], "already supported");
        supportedTokens[token] = true;
        interestRateBps[token] = rateBps == 0 ? defaultInterestRateBps : rateBps;
        tokenList.push(token);
    }
}
