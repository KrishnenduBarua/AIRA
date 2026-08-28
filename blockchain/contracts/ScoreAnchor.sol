// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ScoreAnchor {
    struct Anchor {
        address user;
        uint256 timestamp;
        address anchoredBy;
        bool exists;
    }

    mapping(bytes32 => Anchor) public anchors;

    event ScoreAnchored(
        bytes32 indexed scoreHash,
        address indexed user,
        uint256 timestamp,
        address indexed anchoredBy
    );

    function anchorScore(
        bytes32 scoreHash,
        address user,
        uint256 timestamp
    ) external {
        require(scoreHash != bytes32(0), "score hash required");
        require(user != address(0), "user address required");
        require(!anchors[scoreHash].exists, "score already anchored");

        anchors[scoreHash] = Anchor({
            user: user,
            timestamp: timestamp,
            anchoredBy: msg.sender,
            exists: true
        });

        emit ScoreAnchored(scoreHash, user, timestamp, msg.sender);
    }
}
