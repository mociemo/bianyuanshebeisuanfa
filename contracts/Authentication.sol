// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Authentication
 * @dev 基于区块链的去中心化身份认证合约
 * 支持设备注册、认证、注销，包含设备类型校验
 */
contract Authentication {
    // 设备类型枚举
    enum DeviceType {
        Unknown,    // 0: 未知
        DoorLock,   // 1: 智能门锁
        Camera,     // 2: 摄像头
        Sensor,     // 3: 传感器
        Thermostat, // 4: 温控器
        Light,      // 5: 智能灯
        Appliance   // 6: 家电
    }

    // 设备状态
    enum DeviceStatus {
        None,       // 0: 不存在
        Registered, // 1: 已注册
        Revoked     // 2: 已注销
    }

    // 设备信息结构
    struct DeviceInfo {
        string publicKey;      // 设备公钥
        DeviceType deviceType; // 设备类型
        DeviceStatus status;   // 设备状态
        uint256 registeredAt;  // 注册时间
        uint256 lastAuthAt;    // 最后认证时间
    }

    // 事件定义
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

    event DeviceRevoked(
        address indexed deviceAddress,
        uint256 timestamp
    );

    // 存储设备信息的映射
    mapping(address => DeviceInfo) public devices;

    // 存储允许的设备类型
    mapping(DeviceType => bool) public allowedDeviceTypes;

    // 合约所有者
    address public owner;

    // 修饰符：仅允许已注册的设备
    modifier onlyRegistered(address deviceAddress) {
        require(
            devices[deviceAddress].status == DeviceStatus.Registered,
            "Device not registered"
        );
        _;
    }

    // 修饰符：仅允许合约所有者
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
        // 默认允许所有设备类型
        allowedDeviceTypes[DeviceType.DoorLock] = true;
        allowedDeviceTypes[DeviceType.Camera] = true;
        allowedDeviceTypes[DeviceType.Sensor] = true;
        allowedDeviceTypes[DeviceType.Thermostat] = true;
        allowedDeviceTypes[DeviceType.Light] = true;
        allowedDeviceTypes[DeviceType.Appliance] = true;
    }

    /**
     * @dev 注册新设备
     * @param deviceAddress 设备地址
     * @param publicKey 设备公钥
     * @param deviceType 设备类型
     */
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
            lastAuthAt: 0
        });

        emit DeviceRegistered(
            deviceAddress,
            publicKey,
            DeviceType(deviceType),
            block.timestamp
        );
    }

    /**
     * @dev 设备认证
     * @param deviceAddress 设备地址
     * @param signature 设备签名（简化版本，实际应验证签名）
     * @return 是否认证成功
     */
    function authenticate(
        address deviceAddress,
        bytes calldata signature
    ) external onlyRegistered(deviceAddress) returns (bool) {
        // 更新最后认证时间
        devices[deviceAddress].lastAuthAt = block.timestamp;

        // 简化版：只要设备已注册就认证成功
        // 实际应用中需要验证签名
        emit DeviceAuthenticated(deviceAddress, true, block.timestamp);

        return true;
    }

    /**
     * @dev 注销设备
     * @param deviceAddress 设备地址
     */
    function revokeDevice(
        address deviceAddress
    ) external onlyOwner onlyRegistered(deviceAddress) {
        devices[deviceAddress].status = DeviceStatus.Revoked;

        emit DeviceRevoked(deviceAddress, block.timestamp);
    }

    /**
     * @dev 获取设备信息
     * @param deviceAddress 设备地址
     * @return publicKey 设备公钥
     * @return deviceType 设备类型（uint8格式）
     * @return status 设备状态（uint8格式）
     * @return registeredAt 注册时间
     * @return lastAuthAt 最后认证时间
     */
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
            uint256 lastAuthAt
        )
    {
        DeviceInfo memory info = devices[deviceAddress];
        return (
            info.publicKey,
            uint8(info.deviceType),
            uint8(info.status),
            info.registeredAt,
            info.lastAuthAt
        );
    }

    /**
     * @dev 验证设备是否已注册且状态正常
     * @param deviceAddress 设备地址
     * @return isValid 是否有效
     */
    function isDeviceValid(address deviceAddress) external view returns (bool) {
        return devices[deviceAddress].status == DeviceStatus.Registered;
    }

    /**
     * @dev 验证设备类型
     * @param deviceAddress 设备地址
     * @param deviceType 要验证的设备类型
     * @return isMatch 是否匹配
     */
    function verifyDeviceType(
        address deviceAddress,
        uint8 deviceType
    ) external view returns (bool) {
        return
            devices[deviceAddress].status == DeviceStatus.Registered &&
            devices[deviceAddress].deviceType == DeviceType(deviceType);
    }

    /**
     * @dev 设置设备类型是否允许
     * @param deviceType 设备类型
     * @param allowed 是否允许
     */
    function setDeviceTypeAllowed(
        uint8 deviceType,
        bool allowed
    ) external onlyOwner {
        allowedDeviceTypes[DeviceType(deviceType)] = allowed;
    }
}