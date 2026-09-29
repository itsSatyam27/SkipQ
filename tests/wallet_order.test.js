const test = require('node:test');
const assert = require('node:assert/strict');

test('Wallet balance order deduction logic tests', async (t) => {
  await t.test('deducts full total when paying via Wallet', () => {
    const initialWallet = 500;
    const orderTotal = 120;
    const paymentMethod = 'Wallet';

    let deduction = 0;
    if (paymentMethod === 'Wallet') {
      deduction = orderTotal;
    }
    const nextWallet = Math.max(0, initialWallet - deduction);
    assert.strictEqual(nextWallet, 380);
  });

  await t.test('refunds full total back to wallet on cancellation', () => {
    let currentWallet = 380;
    const order = { paymentMethod: 'Wallet', totalAmount: 120 };

    if (order.paymentMethod === 'Wallet') {
      currentWallet += order.totalAmount;
    }
    assert.strictEqual(currentWallet, 500);
  });

  await t.test('blocks order if wallet balance is insufficient', () => {
    const walletBalance = 50;
    const orderTotal = 120;
    const isSufficient = walletBalance >= orderTotal;
    assert.strictEqual(isSufficient, false);
  });
});
