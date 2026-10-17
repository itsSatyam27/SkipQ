const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateDishDraft}=require('../src/services/dishDraft.cjs');
const draft={name:' Sandwich ',price:'50.50',category:'Snacks',minutes:'5',isVeg:true,description:' Fresh paneer '};
test('dish draft normalizes currency, preparation time and description',()=>{
  assert.deepEqual(validateDishDraft(draft),{name:'Sandwich',price:50.5,category:'Snacks',prepTime:'5 mins',isVeg:true,description:'Fresh paneer'});
  assert.equal(validateDishDraft({...draft,minutes:'0',description:''}).prepTime,'0 mins');
});
test('dish draft rejects partially numeric or invalid amounts and preparation times',()=>{
  for(const price of ['50abc','0','-10','Infinity','NaN','100001','50.123','1e3'])assert.throws(()=>validateDishDraft({...draft,price}));
  for(const minutes of ['','5 mins','-1','181','1.5'])assert.throws(()=>validateDishDraft({...draft,minutes}));
  assert.throws(()=>validateDishDraft({...draft,name:' '}));
  assert.throws(()=>validateDishDraft({...draft,category:'Unknown'}));
});
