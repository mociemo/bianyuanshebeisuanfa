// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Authentication
 * @dev 简化版身份认证合约 — 原论文方案（无链上nonce防重放）
 * 仅负责设备注册、简单认证、注销
 */
contract Authentication {
    enum DeviceType { Unknown, DoorLock, Camera, Sensor, Thermostat, Light, Appliance }
    enum DeviceStatus { None, Registered, Revoked }

    struct DeviceInfo {
        string publicKey;
        DeviceType deviceType;
        DeviceStatus status;
        uint256 registeredAt;
        uint256 lastAuthAt;
    }

    mapping(address => DeviceInfo) public devices;
    mapping(DeviceType => bool) public allowedDeviceTypes;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
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

    function registerDevice(address deviceAddress, string calldata publicKey, uint8 deviceType) external onlyOwner {
        require(devices[deviceAddress].status == DeviceStatus.None, "Already registered");
        require(bytes(publicKey).length > 0, "Empty publicKey");
        require(allowedDeviceTypes[DeviceType(deviceType)], "Invalid device type");

        devices[deviceAddress] = DeviceInfo({
            publicKey: publicKey, deviceType: DeviceType(deviceType),
            status: DeviceStatus.Registered, registeredAt: block.timestamp, lastAuthAt: 0
        });
    }

    function authenticate(address deviceAddress) external returns (bool) {
        require(devices[deviceAddress].status == DeviceStatus.Registered, "Not registered");
        devices[deviceAddress].lastAuthAt = block.timestamp;
        return true;
    }

    function revokeDevice(address deviceAddress) external onlyOwner {
        require(devices[deviceAddress].status == DeviceStatus.Registered, "Not registered");
        devices[deviceAddress].status = DeviceStatus.Revoked;
    }

    function getDeviceInfo(address deviceAddress) external view returns (
        string memory publicKey, uint8 deviceType, uint8 status,
        uint256 registeredAt, uint256 lastAuthAt
    ) {
        DeviceInfo memory info = devices[deviceAddress];
        return (info.publicKey, uint8(info.deviceType), uint8(info.status),
                info.registeredAt, info.lastAuthAt);
    }

    function isDeviceValid(address deviceAddress) external view returns (bool) {
        return devices[deviceAddress].status == DeviceStatus.Registered;
    }
}
