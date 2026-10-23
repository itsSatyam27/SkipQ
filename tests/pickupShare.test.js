const {test}=require('node:test');const assert=require('node:assert/strict');const {pickupShareData}=require('../src/utils/pickupShare.cjs');
const order={orderStatus:'Preparing',pickupPin:'1234',tokenNumber:'SQ-123',shopName:'Canteen',paymentMethod:'Cash',totalAmount:80,items:[{name:'Sandwich',qty:2}],buyerEmail:'private@example.com',buyerPhone:'9999999999'};
test('shared pass includes handover details but excludes personal data and live status',()=>{
 const pass=pickupShareData(order,{location:'Block A'});assert.equal(pass.payment,'₹80 cash at pickup');assert.equal(pass.location,'Block A');assert.equal(pass.pin,'1234');assert.deepEqual(pass.items,[{name:'Sandwich',qty:2}]);const text=JSON.stringify(pass);assert(!text.includes(order.buyerEmail));assert(!text.includes(order.buyerPhone));assert(!text.includes('Preparing'));
});
test('closed orders and missing PIN cannot be shared',()=>{for(const status of ['Completed','Cancelled','Abandoned'])assert.throws(()=>pickupShareData({...order,orderStatus:status}));assert.throws(()=>pickupShareData({...order,pickupPin:null}));});
test('delivery and payment instructions reflect verified payments only',()=>{
 assert.equal(pickupShareData({...order,staffRoomDelivery:true,facultyRoomNote:'Room 10'}).payment,'₹80 cash on delivery');
 assert.equal(pickupShareData({...order,paymentMethod:'UPI'}).payment,'Payment verification pending — confirm with canteen');
 assert.equal(pickupShareData({...order,paymentMethod:'UPI',paymentStatus:'CONFIRMED_BY_MERCHANT'}).payment,'Payment verified by canteen');
 assert.equal(pickupShareData({...order,advanceAmount:20,dueAtCounter:60,advancePaymentStatus:'CONFIRMED_BY_MERCHANT'}).payment,'₹60 cash at pickup');
});
