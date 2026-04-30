/**
 * End-to-end flow exercise. Mirrors the on-chain path the UI uses.
 *
 * Run against a local hardhat node that already has 02_deploy_maeve.ts
 * applied (i.e. `yarn deploy` first):
 *
 *   yarn hardhat run scripts/fullFlow.ts --network localhost
 */
import { parseUnits, formatUnits } from "ethers";
import hre from "hardhat";

async function main() {
  const { ethers, deployments } = hre;
  const [owner, lender, borrower] = await ethers.getSigners();
  // Localhost (hardhat node) caps per-tx gas at ~16.7M; ethers defaults to the
  // 30M block limit when not estimating. Force each tx to a sane value.
  const gas = { gasLimit: 1_000_000n };
  void owner;

  const poolDeployment = await deployments.get("MaevePool");
  const usdcDeployment = await deployments.get("MockUSDC");
  const wethDeployment = await deployments.get("MockWETH");

  const pool = await ethers.getContractAt("MaevePool", poolDeployment.address);
  const usdc = await ethers.getContractAt("MockERC20", usdcDeployment.address);
  const weth = await ethers.getContractAt("MockERC20", wethDeployment.address);

  console.log("Pool:", poolDeployment.address);
  console.log("USDC:", usdcDeployment.address, "WETH:", wethDeployment.address);
  console.log("Lender:", lender.address);
  console.log("Borrower:", borrower.address);

  // 1. Mint mock tokens
  await (await usdc.connect(lender).mint(lender.address, parseUnits("10000", 18), gas)).wait();
  await (await weth.connect(borrower).mint(borrower.address, parseUnits("10", 18), gas)).wait();
  console.log("\n[1] Minted: lender=10000 mUSDC, borrower=10 mWETH");

  // 2. Lender deposits 1000 mUSDC
  await (await usdc.connect(lender).approve(poolDeployment.address, parseUnits("10000", 18), gas)).wait();
  await (await pool.connect(lender).deposit(usdcDeployment.address, parseUnits("1000", 18), gas)).wait();
  console.log("[2] Deposited 1000 mUSDC");

  // 3. Lender accepts mWETH at 75% LTV
  await (
    await pool.connect(lender).setCollateralPreference(usdcDeployment.address, wethDeployment.address, 7500, true, gas)
  ).wait();
  console.log("[3] Set collateral pref: USDC pool accepts WETH @ 75% LTV");

  const effLtv = await pool.getEffectiveLTV(usdcDeployment.address, wethDeployment.address);
  console.log("    Effective LTV (USDC, WETH):", effLtv.toString(), "bps");

  // 4. Borrower borrows 100 mUSDC against 200 mWETH (50% LTV, well under 75%)
  const borrowAmount = parseUnits("100", 18);
  const collAmount = parseUnits("200", 18);

  // Top up borrower so collateral is available; they minted 10 above.
  await (await weth.connect(borrower).mint(borrower.address, parseUnits("200", 18), gas)).wait();

  await (await weth.connect(borrower).approve(poolDeployment.address, collAmount, gas)).wait();
  await (
    await pool.connect(borrower).borrow(usdcDeployment.address, borrowAmount, wethDeployment.address, collAmount, gas)
  ).wait();
  console.log("[4] Borrowed 100 mUSDC against 200 mWETH");

  const balAfterBorrow = await usdc.balanceOf(borrower.address);
  console.log("    Borrower mUSDC after borrow:", formatUnits(balAfterBorrow, 18));

  // 5. Repay
  const owed = await pool.getOutstandingDebt(0n);
  console.log("[5] Outstanding debt on loan 0:", formatUnits(owed, 18), "mUSDC");

  // Borrower needs enough mUSDC to cover principal + tiny accrued interest.
  // Since they only have the borrowed 100, mint a little extra.
  await (await usdc.connect(borrower).mint(borrower.address, parseUnits("10", 18), gas)).wait();
  // Approve a bit over current `owed` -- interest accrues each block so an
  // exact-amount approval can race the repay tx. The UI uses max approve.
  const approveCushion = owed + parseUnits("1", 18);
  await (await usdc.connect(borrower).approve(poolDeployment.address, approveCushion, gas)).wait();
  await (await pool.connect(borrower).repay(0n, gas)).wait();
  console.log("    Repaid loan 0");

  const wethBackToBorrower = await weth.balanceOf(borrower.address);
  console.log("    Borrower mWETH after repay:", formatUnits(wethBackToBorrower, 18));

  // 6. Lender withdraws
  await (await pool.connect(lender).withdraw(usdcDeployment.address, parseUnits("1000", 18), gas)).wait();
  console.log("[6] Lender withdrew 1000 mUSDC");

  const lenderUsdc = await usdc.balanceOf(lender.address);
  console.log("    Lender mUSDC after withdraw:", formatUnits(lenderUsdc, 18));

  console.log("\n✅ Full flow succeeded.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
