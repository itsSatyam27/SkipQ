const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateSellerSettings}=require('../src/services/sellerSettings.cjs');
const draft={name:' Operator ',stallName:' Counter ',location:' Block A ',upiId:' counter@bank ',openingHours:' 8 AM - 8 PM ',isOpen:true};
test('seller settings normalize shared profile and canteen fields without changing linked identity',()=>{
  const result=validateSellerSettings({...draft,email:'changed@example.com',phone:'123',userType:'faculty',ownerId:'other'});
  assert.deepEqual(result.profile,{name:'Operator',stallName:'Counter',stallLocation:'Block A',merchantUpi:'counter@bank'});
  assert.deepEqual(result.canteen,{name:'Counter',location:'Block A',upiId:'counter@bank',openingHours:'8 AM - 8 PM',status:'Open'});
});
test('seller settings support cash only and pause ordering without changing hours',()=>{
  const result=validateSellerSettings({...draft,upiId:'',isOpen:false,openingHours:''});
  assert.equal(result.canteen.upiId,'');assert.equal(result.canteen.status,'Closed');assert.equal(result.canteen.openingHours,'');
});
test('seller settings reject blank names/location and invalid merchant payment addresses',()=>{
  for(const field of ['name','stallName','location'])assert.throws(()=>validateSellerSettings({...draft,[field]:'  '}));
  assert.throws(()=>validateSellerSettings({...draft,upiId:'not a payment address'}),/valid UPI/);
});
