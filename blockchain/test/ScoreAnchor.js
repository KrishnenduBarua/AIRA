const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ScoreAnchor", function () {
  it("stores only the score hash, borrower, and timestamp", async function () {
    const [anchorer, borrower] = await ethers.getSigners();
    const ScoreAnchor = await ethers.getContractFactory("ScoreAnchor");
    const contract = await ScoreAnchor.deploy();
    await contract.waitForDeployment();

    const scoreHash = ethers.keccak256(ethers.toUtf8Bytes("score-001"));
    const timestamp = 1760000000;

    const transaction = await contract.anchorScore(
      scoreHash,
      borrower.address,
      timestamp,
    );
    const receipt = await transaction.wait();
    expect(receipt.logs).to.have.length(1);

    const anchor = await contract.anchors(scoreHash);
    expect(anchor.user).to.equal(borrower.address);
    expect(anchor.timestamp).to.equal(BigInt(timestamp));
    expect(anchor.anchoredBy).to.equal(anchorer.address);
    expect(anchor.exists).to.equal(true);
  });

  it("rejects anchoring the same hash twice", async function () {
    const [borrower] = await ethers.getSigners();
    const ScoreAnchor = await ethers.getContractFactory("ScoreAnchor");
    const contract = await ScoreAnchor.deploy();
    await contract.waitForDeployment();

    const scoreHash = ethers.keccak256(ethers.toUtf8Bytes("duplicate"));
    await contract.anchorScore(scoreHash, borrower.address, 1760000000);

    let errorMessage = "";
    try {
      await contract.anchorScore(scoreHash, borrower.address, 1760000001);
    } catch (error) {
      errorMessage = error.message;
    }

    expect(errorMessage).to.include("score already anchored");
  });

  it("allows only the contract owner to anchor scores", async function () {
    const [owner, other, borrower] = await ethers.getSigners();
    const ScoreAnchor = await ethers.getContractFactory("ScoreAnchor");
    const contract = await ScoreAnchor.deploy();
    await contract.waitForDeployment();

    const scoreHash = ethers.keccak256(ethers.toUtf8Bytes("owner-only"));
    let errorMessage = "";
    try {
      await contract
        .connect(other)
        .anchorScore(scoreHash, borrower.address, 1760000000);
    } catch (error) {
      errorMessage = error.message;
    }
    expect(errorMessage).to.include("only owner can anchor");

    await contract
      .connect(owner)
      .anchorScore(scoreHash, borrower.address, 1760000000);
  });
});
