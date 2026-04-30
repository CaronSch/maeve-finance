import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { MaevePool, MockERC20 } from "../typechain-types";

describe("MaevePool", () => {
  let pool: MaevePool;
  let usdc: MockERC20;
  let weth: MockERC20;
  let owner: Signer;
  let lenderA: Signer;
  let lenderB: Signer;
  let lenderAAddr: string;
  let lenderBAddr: string;
  let usdcAddr: string;
  let wethAddr: string;
  let poolAddr: string;

  const MILLION = ethers.parseUnits("1000000", 18);
  const HUNDRED = ethers.parseUnits("100", 18);
  const FIFTY = ethers.parseUnits("50", 18);

  beforeEach(async () => {
    [owner, lenderA, lenderB] = await ethers.getSigners();
    lenderAAddr = await lenderA.getAddress();
    lenderBAddr = await lenderB.getAddress();

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

    await usdc.connect(lenderA).approve(poolAddr, MILLION);
    await usdc.connect(lenderB).approve(poolAddr, MILLION);
    await weth.connect(lenderA).approve(poolAddr, MILLION);
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
});
