const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Authentication 合约', function () {
    let auth;
    let owner;
    let device;
    let deviceWallet;

    beforeEach(async function () {
        [owner, device] = await ethers.getSigners();
        deviceWallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({
            to: deviceWallet.address,
            value: ethers.parseEther('1')
        });

        const Factory = await ethers.getContractFactory('Authentication');
        auth = await Factory.deploy();
        await auth.waitForDeployment();

        await auth.registerDevice(
            deviceWallet.address,
            deviceWallet.address,
            1
        );
    });

    async function signAuth(wallet, nonce, timestamp, challenge = '') {
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'uint256', 'uint256', 'string', 'string'],
            [wallet.address, nonce, timestamp, challenge, 'authenticate']
        );
        return wallet.signMessage(ethers.getBytes(messageHash));
    }

    it('应正确注册设备并返回 nonce=0', async function () {
        const info = await auth.getDeviceInfo(deviceWallet.address);
        expect(info.status).to.equal(1);
        expect(info.nonce).to.equal(0);
    });

    it('在线认证应递增 nonce 并更新 lastAuthAt', async function () {
        const nonce = 0;
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await signAuth(deviceWallet, nonce, timestamp, '');

        await auth.connect(deviceWallet).authenticate(
            deviceWallet.address,
            nonce,
            timestamp,
            '',
            signature
        );

        const info = await auth.getDeviceInfo(deviceWallet.address);
        expect(info.nonce).to.equal(1);
        expect(info.lastAuthAt).to.be.gt(0);
    });

    it('错误 nonce 应导致认证失败', async function () {
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await signAuth(deviceWallet, 99, timestamp, '');

        await expect(
            auth.connect(deviceWallet).authenticate(
                deviceWallet.address,
                99,
                timestamp,
                '',
                signature
            )
        ).to.be.revertedWith('Invalid nonce');
    });

    it('verifyAuth view 应正确验签', async function () {
        const nonce = 0;
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = await signAuth(deviceWallet, nonce, timestamp, '');

        const valid = await auth.verifyAuth(
            deviceWallet.address,
            nonce,
            timestamp,
            '',
            signature
        );
        expect(valid).to.be.true;
    });

    it('注销后 isDeviceValid 应返回 false', async function () {
        await auth.revokeDevice(deviceWallet.address);
        expect(await auth.isDeviceValid(deviceWallet.address)).to.be.false;
    });
});
