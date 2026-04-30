import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployMaeve: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, execute, get } = hre.deployments;

  await deploy("MaevePool", {
    from: deployer,
    args: [deployer],
    log: true,
    autoMine: true,
  });

  const tokens = [
    { deploymentName: "MockUSDC", rate: 500 },
    { deploymentName: "MockWETH", rate: 300 },
    { deploymentName: "MockWBTC", rate: 200 },
  ];

  for (const t of tokens) {
    const token = await get(t.deploymentName);
    await execute(
      "MaevePool",
      { from: deployer, log: true, autoMine: true },
      "addSupportedToken(address,uint256)",
      token.address,
      t.rate,
    );
    console.log(`Whitelisted ${t.deploymentName} (${token.address}) at ${t.rate} bps`);
  }
};

export default deployMaeve;
deployMaeve.tags = ["MaevePool"];
deployMaeve.dependencies = ["Mocks"];
