const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateSellerSettings,parseWorkingHours,formatWorkingTime,formatWorkingHours}=require('../src/services/sellerSettings.cjs');
const draft={name:' Operator ',stallName:' Counter ',location:' Block A ',upiId:' counter@bank ',openingHours:' 8 AM - 8 PM ',isOpen:true};
test('seller settings normalize shared profile and canteen fields without changing linked identity',()=>{
  const result=validateSellerSettings({...draft,email:'changed@example.com',phone:'123',userType:'faculty',ownerId:'other'});
  assert.deepEqual(result.profile,{name:'Operator',stallName:'Counter',stallLocation:'Block A',merchantUpi:'counter@bank'});
  assert.deepEqual(result.canteen,{name:'Counter',location:'Block A',upiId:'counter@bank',openingHours:'8 AM - 8 PM',status:'Open'});
});
test('seller settings allow sellers to accept cash-only orders without UPI setup',()=>{
  const result=validateSellerSettings({...draft,upiId:''});
  assert.equal(result.canteen.upiId,'');assert.equal(result.canteen.status,'Open');
  const paused=validateSellerSettings({...draft,upiId:'',isOpen:false,openingHours:''});
  assert.equal(paused.canteen.upiId,'');assert.equal(paused.canteen.status,'Closed');assert.equal(paused.canteen.openingHours,'');
});
test('seller settings reject blank names/location and invalid merchant payment addresses',()=>{
  for(const field of ['name','stallName','location'])assert.throws(()=>validateSellerSettings({...draft,[field]:'  '}));
  assert.throws(()=>validateSellerSettings({...draft,upiId:'not a payment address'}),/valid merchant UPI/);
});
test('working hours parse legacy formats and format selected times consistently',()=>{
  assert.deepEqual(parseWorkingHours('8 AM - 8 PM'),[480,1200]);
  assert.deepEqual(parseWorkingHours('08:30 AM - 09:15 PM'),[510,1275]);
  assert.deepEqual(parseWorkingHours('12:00 AM - 12:00 PM'),[0,720]);
  assert.equal(formatWorkingTime(0),'12:00 AM');
  assert.equal(formatWorkingTime(810),'01:30 PM');
  assert.equal(formatWorkingHours(510,1275),'08:30 AM - 09:15 PM');
});
