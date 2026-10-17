const {test}=require('node:test');
const assert=require('node:assert/strict');
const {selectOwnedCanteen}=require('../src/services/sellerCanteen.cjs');
const shops=[{id:'foreign',ownerId:'other',universityId:'sou'},{id:'mine',ownerId:'seller',universityId:'sou'},{id:'second',ownerId:'seller',universityId:'sou'},{id:'elsewhere',ownerId:'seller',universityId:'other-campus'}];
test('seller canteen resolves after approval with a missing or stale saved selection',()=>{
  assert.equal(selectOwnedCanteen(shops,'seller','sou',null,null).id,'mine');
  assert.equal(selectOwnedCanteen(shops,'seller','sou','deleted','second').id,'second');
  assert.equal(selectOwnedCanteen(shops,'seller','sou','second','mine').id,'second');
});
test('seller resolution never picks another owner or campus and supports empty setup',()=>{
  assert.equal(selectOwnedCanteen(shops,'seller','sou','foreign','elsewhere').id,'mine');
  assert.equal(selectOwnedCanteen(shops,'new-seller','sou',null,null),null);
  assert.equal(selectOwnedCanteen([],'seller','sou',null,null),null);
});
