import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addressParts,lastCustomer,readSavedCustomers,rememberCustomer} from '../src/utils/saved-checkout';
function storage() { const data = new Map<string,string>(); return {getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>{data.set(key,value);}} as unknown as Storage; }
const customer={name:' Ana ',phone:'(41) 99999-9999',address:'Rua A, 12 - Centro, Colombo - PR, 83400-000',deliveryAddress:{street:'Rua A',number:'12',neighborhood:'Centro',city:'Colombo',state:'PR',cep:'83400-000'}};
test('saved details restore structured address and digits and deduplicate repeated orders',()=>{
 const target=storage(); const first=rememberCustomer(customer,target)[0]; rememberCustomer(customer,target);
 assert.equal(readSavedCustomers(target).length,1);assert.equal(lastCustomer(target).phone,'41999999999');assert.equal(lastCustomer(target).name,'Ana');assert.equal(readSavedCustomers(target)[0].id,first.id);assert.deepEqual(addressParts(lastCustomer(target)),customer.deliveryAddress);
 for(let i=0;i<12;i++)rememberCustomer({...customer,name:`Pessoa ${i}`},target);
 assert.equal(readSavedCustomers(target).length,8);assert.equal(lastCustomer(target).name,'Pessoa 11');
});
test('corrupt or inaccessible storage does not block checkout and incomplete details are not saved',()=>{
 const target=storage(); target.setItem('vovoh_saved_checkout','{broken'); assert.deepEqual(readSavedCustomers(target),[]);
 rememberCustomer({...customer,phone:'1'},target);assert.deepEqual(readSavedCustomers(target),[]);
 const denied={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}} as unknown as Storage;
 assert.doesNotThrow(()=>rememberCustomer(customer,denied));assert.deepEqual(lastCustomer(denied),{name:'',phone:'',address:''});
});
test('legacy local orders restore name, phone and all parseable address fields',()=>{
 const target=storage();target.setItem('vovoh_active_orders',JSON.stringify([{customer:{...customer,deliveryAddress:undefined}}]));
 assert.equal(lastCustomer(target).phone,'41999999999');assert.deepEqual(addressParts(lastCustomer(target)),customer.deliveryAddress);
});
