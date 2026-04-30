import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Signer } from "ethers";
import { MaevePool, MockERC20 } from "../typechain-types";

describe("MaevePool", () => {
  let pool: MaevePool;
  let usdc: MockERC20;
  let weth: MockERC20;
  let owner: Signer;
  let lenderA: Signer;
  let lenderB: Signer;
  let borrower: Signer;
  let lenderAAddr: string;
  let lenderBAddr: string;
  let borrowerAddr: string;
  let usdcAddr: string;
  let wethAddr: string;
  let poolAddr: string;

  const MILLION = ethers.parseUnits("1000000", 18);
  const HUNDRED = ethers.parseUnits("100", 18);
  const FIFTY = ethers.parseUnits("50", 18);

  beforeEach(async () => {
    [owner, lenderA, lenderB, borrower] = await ethers.getSigners();
    lenderAAddr = await lenderA.getAddress();
    lenderBAddr = await lenderB.getAddress();
    borrowerAddr = await borrower.getAddress();

    const ERC20Factory = await ethers.getContractFactory("MockERC20");
    usdc = (await ERC20Factory.deploy("Mock USDC", "mUSDC")) as unknown as MockERC20;
    weth = (await ERC20Factory.deploy("Mock WETH", "mWETH")) as unknown as MockERC20;
    await usdc.waitForDeployment();
    await weth.waitForDeployment();
    usdcAddr = await usdc.getAddress();
    wethAddr = await weth.getAddress();

    const PoolFactory = await ethers.getContractFactory("MaevePool");
    pool = (await PoolFactory.deploy(await owner.getAddress())) as unknown as MaevePool;
    await pool.waitForDeployment();
    poolAddr = await pool.getAddress();

    await pool.connect(owner).addSupportedToken(usdcAddr, 500);
    await pool.connect(owner).addSupportedToken(wethAddr, 300);

    await usdc.mint(lenderAAddr, MILLION);
    await usdc.mint(lenderBAddr, MILLION);
    await weth.mint(lenderAAddr, MILLION);
    await weth.mint(borrowerAddr, MILLION);
    await usdc.mint(borrowerAddr, MILLION);

    await usdc.connect(lenderA).approve(poolAddr, MILLION);
    await usdc.connect(lenderB).approve(poolAddr, MILLION);
    await weth.connect(lenderA).approve(poolAddr, MILLION);
    await weth.connect(borrower).approve(poolAddr, MILLION);
    await usdc.connect(borrower).approve(poolAddr, MILLION);
  });

  describe("deposit + withdraw", () => {
    it("deposits and updates state", async () => {
      await expect(pool.connect(lenderA).deposit(usdcAddr, HUNDRED))
        .to.emit(pool, "Deposited")
        .withArgs(lenderAAddr, usdcAddr, HUNDRED);

      const dep = await pool.deposits(usdcAddr, lenderAAddr);
      expect(dep.amount).to.equal(HUNDRED);
      expect(await pool.totalDeposited(usdcAddr)).to.equal(HUNDRED);
      expect(await usdc.balanceOf(poolAddr)).to.equal(HUNDRED);
    });

    it("rejects deposits of unsupported tokens", async () => {
      const ERC20Factory = await ethers.getContractFactory("MockERC20");
      const random = (await ERC20Factory.deploy("Random", "RAND")) as unknown as MockERC20;
      await random.waitForDeployment();
      await random.mint(lenderAAddr, HUNDRED);
      await random.connect(lenderA).approve(poolAddr, HUNDRED);
      await expect(pool.connect(lenderA).deposit(await random.getAddress(), HUNDRED)).to.be.revertedWith(
        "token not supported",
      );
    });

    it("accumulates on repeat deposits without duplicating depositor entry", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, HUNDRED);
      await pool.connect(lenderA).deposit(usdcAddr, FIFTY);

      const dep = await pool.deposits(usdcAddr, lenderAAddr);
      expect(dep.amount).to.equal(HUNDRED + FIFTY);
      expect(await pool.depositors(usdcAddr, 0)).to.equal(lenderAAddr);
      await expect(pool.depositors(usdcAddr, 1)).to.be.reverted;
    });

    it("withdraws and updates state", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, HUNDRED);
      const balBefore = await usdc.balanceOf(lenderAAddr);

      await expect(pool.connect(lenderA).withdraw(usdcAddr, FIFTY))
        .to.emit(pool, "Withdrawn")
        .withArgs(lenderAAddr, usdcAddr, FIFTY);

      const dep = await pool.deposits(usdcAddr, lenderAAddr);
      expect(dep.amount).to.equal(HUNDRED - FIFTY);
      expect(await pool.totalDeposited(usdcAddr)).to.equal(HUNDRED - FIFTY);
      expect(await usdc.balanceOf(lenderAAddr)).to.equal(balBefore + FIFTY);
    });

    it("rejects withdraw beyond balance", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, HUNDRED);
      await expect(pool.connect(lenderA).withdraw(usdcAddr, HUNDRED + 1n)).to.be.revertedWith("insufficient deposit");
    });
  });

  describe("collateral preferences", () => {
    beforeEach(async () => {
      await pool.connect(lenderA).deposit(usdcAddr, HUNDRED);
    });

    it("sets a collateral preference", async () => {
      await expect(pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 7500, true))
        .to.emit(pool, "CollateralPrefSet")
        .withArgs(lenderAAddr, usdcAddr, wethAddr, 7500, true);

      const pref = await pool.collateralPrefs(usdcAddr, lenderAAddr, wethAddr);
      expect(pref.collateralToken).to.equal(wethAddr);
      expect(pref.maxLTV).to.equal(7500);
      expect(pref.active).to.equal(true);
    });

    it("can be toggled inactive without withdrawing", async () => {
      await pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 7500, true);
      await pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 7500, false);
      const pref = await pool.collateralPrefs(usdcAddr, lenderAAddr, wethAddr);
      expect(pref.active).to.equal(false);
    });

    it("rejects ltv > 90%", async () => {
      await expect(pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 9001, true)).to.be.revertedWith(
        "ltv exceeds 90%",
      );
    });

    it("rejects pref from a non-depositor", async () => {
      await expect(pool.connect(lenderB).setCollateralPreference(usdcAddr, wethAddr, 7500, true)).to.be.revertedWith(
        "no deposit",
      );
    });
  });

  describe("getAvailableLiquidity", () => {
    it("returns total deposited when nothing borrowed", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, HUNDRED);
      await pool.connect(lenderB).deposit(usdcAddr, FIFTY);
      expect(await pool.getAvailableLiquidity(usdcAddr)).to.equal(HUNDRED + FIFTY);
    });

    it("decreases as withdrawals reduce total deposited", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, HUNDRED);
      await pool.connect(lenderA).withdraw(usdcAddr, FIFTY);
      expect(await pool.getAvailableLiquidity(usdcAddr)).to.equal(FIFTY);
    });
  });

  describe("getEffectiveLTV", () => {
    beforeEach(async () => {
      await pool.connect(lenderA).deposit(usdcAddr, HUNDRED);
      await pool.connect(lenderB).deposit(usdcAddr, HUNDRED);
    });

    it("averages maxLTV across active depositors", async () => {
      await pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 7000, true);
      await pool.connect(lenderB).setCollateralPreference(usdcAddr, wethAddr, 8000, true);
      expect(await pool.getEffectiveLTV(usdcAddr, wethAddr)).to.equal(7500);
    });

    it("ignores inactive prefs", async () => {
      await pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 7000, true);
      await pool.connect(lenderB).setCollateralPreference(usdcAddr, wethAddr, 8000, false);
      expect(await pool.getEffectiveLTV(usdcAddr, wethAddr)).to.equal(7000);
    });

    it("returns 0 when no lender has set a pref for the pair", async () => {
      expect(await pool.getEffectiveLTV(usdcAddr, wethAddr)).to.equal(0);
    });
  });

  describe("borrow + repay", () => {
    const ONE_THOUSAND = ethers.parseUnits("1000", 18);
    const YEAR = 365 * 24 * 60 * 60;

    it("end-to-end: deposit → set prefs → borrow → repay", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, ONE_THOUSAND);
      await pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 7500, true);

      const borrowAmount = FIFTY; // 50 mUSDC
      const collateralAmount = HUNDRED; // 100 mWETH (LTV = 50%, well below 75%)

      const borrowerUsdcBefore = await usdc.balanceOf(borrowerAddr);
      const borrowerWethBefore = await weth.balanceOf(borrowerAddr);

      await expect(pool.connect(borrower).borrow(usdcAddr, borrowAmount, wethAddr, collateralAmount))
        .to.emit(pool, "Borrowed")
        .withArgs(borrowerAddr, 0, usdcAddr, borrowAmount, wethAddr, collateralAmount);

      expect(await usdc.balanceOf(borrowerAddr)).to.equal(borrowerUsdcBefore + borrowAmount);
      expect(await weth.balanceOf(borrowerAddr)).to.equal(borrowerWethBefore - collateralAmount);
      expect(await pool.totalBorrowed(usdcAddr)).to.equal(borrowAmount);

      const loan = await pool.getLoanDetails(0);
      expect(loan.borrower).to.equal(borrowerAddr);
      expect(loan.borrowAmount).to.equal(borrowAmount);
      expect(loan.collateralAmount).to.equal(collateralAmount);
      expect(loan.active).to.equal(true);

      await pool.connect(borrower).repay(0);

      const loanAfter = await pool.getLoanDetails(0);
      expect(loanAfter.active).to.equal(false);
      expect(await pool.totalBorrowed(usdcAddr)).to.equal(0);
      // Collateral fully returned (interest barely accrued — same block).
      expect(await weth.balanceOf(borrowerAddr)).to.equal(borrowerWethBefore);
    });

    it("rejects borrow when no lender accepts the collateral pair", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, ONE_THOUSAND);
      // No setCollateralPreference -- effectiveLTV is 0.
      await expect(pool.connect(borrower).borrow(usdcAddr, FIFTY, wethAddr, HUNDRED)).to.be.revertedWith(
        "no lender accepts collateral",
      );
    });

    it("rejects borrow when liquidity is insufficient", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, FIFTY);
      await pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 7500, true);
      const tooMuch = ethers.parseUnits("100", 18);
      await expect(
        pool.connect(borrower).borrow(usdcAddr, tooMuch, wethAddr, ethers.parseUnits("200", 18)),
      ).to.be.revertedWith("insufficient liquidity");
    });

    it("rejects borrow when collateral is too low for the effective LTV", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, ONE_THOUSAND);
      await pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 5000, true);
      // 5000 bps = 50% LTV, so borrowing 100 needs >= 200 collateral.
      await expect(pool.connect(borrower).borrow(usdcAddr, HUNDRED, wethAddr, FIFTY)).to.be.revertedWith(
        "collateral too low",
      );
    });

    it("accrues interest at the configured rate (5% / year on USDC)", async () => {
      await pool.connect(lenderA).deposit(usdcAddr, ONE_THOUSAND);
      await pool.connect(lenderA).setCollateralPreference(usdcAddr, wethAddr, 7500, true);

      const borrowAmount = ethers.parseUnits("100", 18);
      await pool.connect(borrower).borrow(usdcAddr, borrowAmount, wethAddr, ethers.parseUnits("200", 18));

      // Advance one year and check outstanding debt.
      await time.increase(YEAR);
      const owed = await pool.getOutstandingDebt(0);
      // 5% of 100 = 5. Allow ±1 wei rounding from integer division.
      const expected = ethers.parseUnits("105", 18);
      expect(owed).to.be.closeTo(expected, 1n);

      // Repaying transfers totalOwed; borrower had 1M minted at setup so they cover the interest.
      await pool.connect(borrower).repay(0);
      expect(await pool.getOutstandingDebt(0)).to.equal(0);
    });
  });
});
