// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Maeve Finance — Lender-defined collateral lending pool
// HACKATHON BUILD: Not audited. Shortcuts documented inline.

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MaevePool is Ownable {
    using SafeERC20 for IERC20;

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

    // Per-token list of lender addresses, used by getEffectiveLTV.
    // SHORTCUT: append-only, no dedupe. If a lender withdraws fully and re-deposits
    // they appear twice. Leaks gas in getEffectiveLTV over time. A real protocol
    // would use an EnumerableSet or eliminate the iteration entirely via shares.
    mapping(address => address[]) public depositors;

    // Default rate applied when a token is whitelisted without an explicit rate.
    uint256 public defaultInterestRateBps;

    // Maximum LTV a lender can specify, in basis points (90%).
    uint256 public constant MAX_ALLOWED_LTV = 9000;

    // --- Events ---

    event Deposited(address indexed lender, address indexed token, uint256 amount);
    event Withdrawn(address indexed lender, address indexed token, uint256 amount);
    event CollateralPrefSet(
        address indexed lender,
        address indexed depositToken,
        address indexed collateralToken,
        uint256 maxLTV,
        bool active
    );
    event Borrowed(
        address indexed borrower,
        uint256 indexed loanId,
        address borrowToken,
        uint256 borrowAmount,
        address collateralToken,
        uint256 collateralAmount
    );
    event Repaid(address indexed borrower, uint256 indexed loanId, uint256 totalOwed);
    event TokenSupported(address indexed token, uint256 rateBps);

    constructor(address _owner) Ownable(_owner) {
        defaultInterestRateBps = 500; // 5%
    }

    // --- Admin: token whitelist ---

    function addSupportedToken(address token) external onlyOwner {
        _addSupportedToken(token, defaultInterestRateBps);
    }

    function addSupportedToken(address token, uint256 rateBps) external onlyOwner {
        _addSupportedToken(token, rateBps);
    }

    function _addSupportedToken(address token, uint256 rateBps) internal {
        require(token != address(0), "zero token");
        require(!supportedTokens[token], "already supported");
        supportedTokens[token] = true;
        interestRateBps[token] = rateBps;
        tokenList.push(token);
        emit TokenSupported(token, rateBps);
    }

    // --- Lender flows ---

    function deposit(address token, uint256 amount) external {
        require(supportedTokens[token], "token not supported");
        require(amount > 0, "zero amount");

        Deposit storage d = deposits[token][msg.sender];

        // SHORTCUT: track depositors via append-only push when this is a fresh entry.
        // No share token minting -- a real protocol mints shares whose value grows
        // with accrued interest, which also avoids the per-token depositor list.
        if (d.amount == 0) {
            depositors[token].push(msg.sender);
        }

        // SHORTCUT: existing balances simply accumulate. No interest-aware rebalancing.
        d.amount += amount;
        d.depositTimestamp = block.timestamp;

        totalDeposited[token] += amount;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, token, amount);
    }

    function setCollateralPreference(
        address depositToken,
        address collateralToken,
        uint256 maxLTV,
        bool active
    ) external {
        require(supportedTokens[depositToken], "deposit token not supported");
        require(supportedTokens[collateralToken], "collateral token not supported");
        require(deposits[depositToken][msg.sender].amount > 0, "no deposit");
        require(maxLTV <= MAX_ALLOWED_LTV, "ltv exceeds 90%");

        // THIS IS THE CORE MECHANIC: lenders explicitly opt in to which collateral
        // backs their funds. Borrowers must pick a (deposit, collateral) pair the
        // lenders of that pool actually accept.
        collateralPrefs[depositToken][msg.sender][collateralToken] = CollateralPreference({
            collateralToken: collateralToken,
            maxLTV: maxLTV,
            active: active
        });

        emit CollateralPrefSet(msg.sender, depositToken, collateralToken, maxLTV, active);
    }

    function withdraw(address token, uint256 amount) external {
        require(amount > 0, "zero amount");

        Deposit storage d = deposits[token][msg.sender];
        require(d.amount >= amount, "insufficient deposit");
        require(getAvailableLiquidity(token) >= amount, "insufficient liquidity");

        // TODO: accrue interest before withdrawal
        d.amount -= amount;
        totalDeposited[token] -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
    }

    // --- Views ---

    function getAvailableLiquidity(address token) public view returns (uint256) {
        return totalDeposited[token] - totalBorrowed[token];
    }

    function getEffectiveLTV(address borrowToken, address collateralToken) public view returns (uint256) {
        // SHORTCUT: O(n) iteration over the borrowToken depositor list. Won't scale
        // past a handful of depositors. A production version would use a
        // deposit-weighted average and/or a governance-set parameter, and would
        // not iterate user storage on a hot path.
        address[] storage list = depositors[borrowToken];
        uint256 sum = 0;
        uint256 count = 0;
        for (uint256 i = 0; i < list.length; i++) {
            address lender = list[i];
            CollateralPreference storage p = collateralPrefs[borrowToken][lender][collateralToken];
            // Only count lenders who still hold a deposit AND have an active pref for this collateral.
            if (p.active && deposits[borrowToken][lender].amount > 0) {
                sum += p.maxLTV;
                count += 1;
            }
        }
        if (count == 0) return 0;
        return sum / count;
    }

    function getLoanDetails(uint256 loanId) public view returns (Loan memory) {
        return loans[loanId];
    }

    // --- Credit scoring (signature feature) ---

    function getTokenCreditScore(address token) public view returns (uint256 score, uint256 numLenders) {
        // SHORTCUT: O(supportedTokens * depositors). Acceptable for a demo. A real
        // protocol would maintain an aggregate index updated on setCollateralPreference,
        // or compute this off-chain from emitted events.
        // SHORTCUT: Not weighted by deposit size. Real version weights by deposit
        // amount so a whale's preference matters more than a dust depositor.
        uint256 totalLTV = 0;
        uint256 count = 0;
        for (uint256 i = 0; i < tokenList.length; i++) {
            address depositToken = tokenList[i];
            address[] storage list = depositors[depositToken];
            for (uint256 j = 0; j < list.length; j++) {
                address lender = list[j];
                CollateralPreference storage p = collateralPrefs[depositToken][lender][token];
                if (p.active && deposits[depositToken][lender].amount > 0) {
                    totalLTV += p.maxLTV;
                    count += 1;
                }
            }
        }
        if (count == 0) return (0, 0);
        return (totalLTV / count, count);
    }

    function getAllTokenScores() public view returns (address[] memory tokens, uint256[] memory scores) {
        uint256 n = tokenList.length;
        tokens = new address[](n);
        scores = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            tokens[i] = tokenList[i];
            (uint256 s, ) = getTokenCreditScore(tokenList[i]);
            scores[i] = s;
        }
    }

    function getOutstandingDebt(uint256 loanId) public view returns (uint256) {
        Loan storage l = loans[loanId];
        if (!l.active) return 0;
        uint256 timeElapsed = block.timestamp - l.borrowTimestamp;
        uint256 rate = interestRateBps[l.borrowToken];
        uint256 interest = (l.borrowAmount * rate * timeElapsed) / (10000 * 365 days);
        return l.borrowAmount + interest;
    }

    // --- Borrower flows ---

    function borrow(
        address borrowToken,
        uint256 borrowAmount,
        address collateralToken,
        uint256 collateralAmount
    ) external {
        require(supportedTokens[borrowToken], "borrow token not supported");
        require(supportedTokens[collateralToken], "collateral token not supported");
        require(borrowAmount > 0, "zero borrow");
        require(collateralAmount > 0, "zero collateral");

        uint256 effectiveLTV = getEffectiveLTV(borrowToken, collateralToken);
        require(effectiveLTV > 0, "no lender accepts collateral");

        // HACKATHON: Using 1:1 price assumption. Real protocol needs Chainlink/Pyth
        // oracle for cross-asset LTV calculation.
        uint256 required = (borrowAmount * 10000) / effectiveLTV;
        require(collateralAmount >= required, "collateral too low");

        require(getAvailableLiquidity(borrowToken) >= borrowAmount, "insufficient liquidity");

        // Effects before interactions.
        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            borrowToken: borrowToken,
            borrowAmount: borrowAmount,
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            borrowTimestamp: block.timestamp,
            active: true
        });
        totalBorrowed[borrowToken] += borrowAmount;

        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);
        IERC20(borrowToken).safeTransfer(msg.sender, borrowAmount);

        emit Borrowed(msg.sender, loanId, borrowToken, borrowAmount, collateralToken, collateralAmount);
    }

    function repay(uint256 loanId) external {
        Loan storage l = loans[loanId];
        require(l.active, "loan inactive");
        require(l.borrower == msg.sender, "not borrower");

        // SHORTCUT: full repay only -- partial repayment is not supported.
        uint256 totalOwed = getOutstandingDebt(loanId);

        address borrowToken = l.borrowToken;
        address collateralToken = l.collateralToken;
        uint256 borrowAmount = l.borrowAmount;
        uint256 collateralAmount = l.collateralAmount;

        // Effects before interactions.
        l.active = false;
        totalBorrowed[borrowToken] -= borrowAmount;

        IERC20(borrowToken).safeTransferFrom(msg.sender, address(this), totalOwed);
        IERC20(collateralToken).safeTransfer(msg.sender, collateralAmount);

        // SHORTCUT: interest sits in the pool generically -- it is not routed back
        // to specific lenders. TODO: route interest to lenders proportionally to
        // their deposit and active collateral prefs at the time of the loan.

        emit Repaid(msg.sender, loanId, totalOwed);
    }
}
