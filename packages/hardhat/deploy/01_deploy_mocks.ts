import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseUnits } from "ethers";

// SHORTCUT: All mocks use 18 decimals (OZ ERC20 default). Real USDC is 6, real WBTC is 8.
// We're keeping 18 across the board for hackathon math simplicity.

const deployMocks: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute } = hre.deployments;

  const tokens = [
    { deploymentName: "MockUSDC", name: "Mock USDC", symbol: "mUSDC" },
    { deploymentName: "MockWETH", name: "Mock WETH", symbol: "mWETH" },
    { deploymentName: "MockWBTC", name: "Mock WBTC", symbol: "mWBTC" },
  ];

  const mintAmount = parseUnits("1000000", 18);

  for (const t of tokens) {
    await deploy(t.deploymentName, {
      contract: "MockERC20",
      from: deployer,
      args: [t.name, t.symbol],
      log: true,
      autoMine: true,
    });

    await execute(t.deploymentName, { from: deployer, log: true, autoMine: true }, "mint", deployer, mintAmount);
    console.log(`Minted 1,000,000 ${t.symbol} to ${deployer}`);
  }
};

export default deployMocks;
deployMocks.tags = ["Mocks"];
