// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Guestbook
/// @notice Anyone can sign. Nobody can edit or delete a signature,
///         including whoever deployed this contract.
contract Guestbook {
    struct Entry {
        address signer;
        string  name;
        string  message;
        uint64  timestamp;
        uint64  blockNumber;
    }

    uint256 public constant MAX_NAME    = 32;   // bytes
    uint256 public constant MAX_MESSAGE = 200;  // bytes

    Entry[] private entries;

    event Signed(uint256 indexed id, address indexed signer, string name, string message);

    /// @notice Add a line to the guestbook.
    function sign(string calldata name, string calldata message) external {
        require(bytes(name).length > 0 && bytes(name).length <= MAX_NAME, "Name must be 1-32 bytes");
        require(bytes(message).length > 0 && bytes(message).length <= MAX_MESSAGE, "Message must be 1-200 bytes");

        entries.push(Entry(msg.sender, name, message, uint64(block.timestamp), uint64(block.number)));
        emit Signed(entries.length, msg.sender, name, message);
    }

    /// @notice How many signatures exist.
    function count() external view returns (uint256) {
        return entries.length;
    }

    /// @notice Up to `n` entries, newest first.
    function getLatest(uint256 n) external view returns (Entry[] memory latest) {
        uint256 total = entries.length;
        uint256 size  = n < total ? n : total;
        latest = new Entry[](size);
        for (uint256 i = 0; i < size; i++) {
            latest[i] = entries[total - 1 - i];
        }
    }
}
