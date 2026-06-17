// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Authentication
 * @dev 全去中心化身份认证合约 — 链上为唯一持久化真相源
 * 支持设备注册、签名认证（链上 nonce 防重放）、注销
 */
contract Authentication {
    enum DeviceType {
        Unknown,
        DoorLock,
        Camera,
        Sensor,
        Thermostat,
        Light,
        Appliance
    }

    enum DeviceStatus {
        None,
        Registered,
        Revoked
    }

    struct DeviceInfo {
        string publicKey;
        DeviceType deviceType;
        DeviceStatus status;
        uint256 registeredAt;
        uint256 lastAuthAt;
        uint256 nonce;
    }

    string public constant AUTH_ACTION = "authenticate";
    uint256 public constant MAX_TIMESTAMP_WINDOW = 300;

    event DeviceRegistered(
        address indexed deviceAddress,
        string publicKey,
        DeviceType deviceType,
        uint256 timestamp
    );

    event DeviceAuthenticated(
        address indexed deviceAddress,
        bool success,
        uint256 timestamp
    );

    event DeviceRevoked(address indexed deviceAddress, uint256 timestamp);

    mapping(address => DeviceInfo) public devices;
    mapping(DeviceType => bool) public allowedDeviceTypes;

    address public owner;

    modifier onlyRegistered(address deviceAddress) {
        require(
            devices[deviceAddress].status == DeviceStatus.Registered,
            "Device not registered"
        );
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
        allowedDeviceTypes[DeviceType.DoorLock] = true;
        allowedDeviceTypes[DeviceType.Camera] = true;
        allowedDeviceTypes[DeviceType.Sensor] = true;
        allowedDeviceTypes[DeviceType.Thermostat] = true;
        allowedDeviceTypes[DeviceType.Light] = true;
        allowedDeviceTypes[DeviceType.Appliance] = true;
    }

    function registerDevice(
        address deviceAddress,
        string calldata publicKey,
        uint8 deviceType
    ) external onlyOwner {
        require(
            devices[deviceAddress].status == DeviceStatus.None,
            "Device already registered"
        );
        require(bytes(publicKey).length > 0, "Public key cannot be empty");
        require(
            allowedDeviceTypes[DeviceType(deviceType)],
            "Invalid device type"
        );

        devices[deviceAddress] = DeviceInfo({
            publicKey: publicKey,
            deviceType: DeviceType(deviceType),
            status: DeviceStatus.Registered,
            registeredAt: block.timestamp,
            lastAuthAt: 0,
            nonce: 0
        });

        emit DeviceRegistered(
            deviceAddress,
            publicKey,
            DeviceType(deviceType),
            block.timestamp
        );
    }

    function authenticate(
        address deviceAddress,
        uint256 nonce,
        uint256 timestamp,
        string calldata challenge,
        bytes calldata signature
    ) external onlyRegistered(deviceAddress) returns (bool) {
        DeviceInfo storage device = devices[deviceAddress];

        require(nonce == device.nonce, "Invalid nonce");
        require(timestamp <= block.timestamp + 60, "Timestamp in future");
        require(
            block.timestamp - timestamp <= MAX_TIMESTAMP_WINDOW,
            "Timestamp expired"
        );
        require(
            _verifySignature(
                deviceAddress,
                nonce,
                timestamp,
                challenge,
                signature
            ),
            "Invalid signature"
        );

        device.nonce++;
        device.lastAuthAt = block.timestamp;

        emit DeviceAuthenticated(deviceAddress, true, block.timestamp);
        return true;
    }

    function verifyAuth(
        address deviceAddress,
        uint256 nonce,
        uint256 timestamp,
        string calldata challenge,
        bytes calldata signature
    ) external view returns (bool) {
        if (devices[deviceAddress].status != DeviceStatus.Registered) {
            return false;
        }
        if (nonce != devices[deviceAddress].nonce) {
            return false;
        }
        if (timestamp > block.timestamp + 60) {
            return false;
        }
        if (block.timestamp - timestamp > MAX_TIMESTAMP_WINDOW) {
            return false;
        }
        return
            _verifySignature(
                deviceAddress,
                nonce,
                timestamp,
                challenge,
                signature
            );
    }

    function revokeDevice(
        address deviceAddress
    ) external onlyOwner onlyRegistered(deviceAddress) {
        devices[deviceAddress].status = DeviceStatus.Revoked;
        emit DeviceRevoked(deviceAddress, block.timestamp);
    }

    function getDeviceInfo(
        address deviceAddress
    )
        external
        view
        returns (
            string memory publicKey,
            uint8 deviceType,
            uint8 status,
            uint256 registeredAt,
            uint256 lastAuthAt,
            uint256 nonce
        )
    {
        DeviceInfo memory info = devices[deviceAddress];
        return (
            info.publicKey,
            uint8(info.deviceType),
            uint8(info.status),
            info.registeredAt,
            info.lastAuthAt,
            info.nonce
        );
    }

    function getNonce(address deviceAddress) external view returns (uint256) {
        return devices[deviceAddress].nonce;
    }

    function isDeviceValid(address deviceAddress) external view returns (bool) {
        return devices[deviceAddress].status == DeviceStatus.Registered;
    }

    function verifyDeviceType(
        address deviceAddress,
        uint8 deviceType
    ) external view returns (bool) {
        return
            devices[deviceAddress].status == DeviceStatus.Registered &&
            devices[deviceAddress].deviceType == DeviceType(deviceType);
    }

    function setDeviceTypeAllowed(
        uint8 deviceType,
        bool allowed
    ) external onlyOwner {
        allowedDeviceTypes[DeviceType(deviceType)] = allowed;
    }

    function _verifySignature(
        address deviceAddress,
        uint256 nonce,
        uint256 timestamp,
        string calldata challenge,
        bytes calldata signature
    ) internal pure returns (bool) {
        if (signature.length != 65) {
            return false;
        }

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                deviceAddress,
                nonce,
                timestamp,
                challenge,
                AUTH_ACTION
            )
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        if (v < 27) {
            v += 27;
        }

        address signer = ecrecover(ethSignedHash, v, r, s);
        return signer == deviceAddress;
    }
}
