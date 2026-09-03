const hre = require("hardhat");

async function main() {
  const ScoreAnchor = await hre.ethers.getContractFactory("ScoreAnchor");
  const contract = await ScoreAnchor.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const network = await hre.ethers.provider.getNetwork();
  console.log(`ScoreAnchor deployed to ${address}`);
  console.log(`Network chain ID: ${network.chainId}`);
  console.log(`Set ANCHOR_CONTRACT_ADDRESS=${address} in backend/.env`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
