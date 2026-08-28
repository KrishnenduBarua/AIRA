const hre = require("hardhat");

async function main() {
  const ScoreAnchor = await hre.ethers.getContractFactory("ScoreAnchor");
  const contract = await ScoreAnchor.deploy();
  await contract.waitForDeployment();

  console.log(`ScoreAnchor deployed to ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
