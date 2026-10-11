import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeAvailability, openingTime } from '../src/utils/store-hours';

test('shop hours use Sao Paulo independently of the customer timezone and close at the exact boundary', () => {
  const original = process.env.TZ;
  try {
    const configs = { opening_start:'10:00', opening_end:'22:00', working_days:'[0,1,2,3,4,5,6]' };
    for (const zone of ['UTC','Asia/Tokyo','America/Los_Angeles']) {
      process.env.TZ=zone;
      assert.equal(storeAvailability(configs,new Date('2026-10-11T12:59:59Z')).open,false);
      assert.equal(storeAvailability(configs,new Date('2026-10-11T13:00:00Z')).open,true);
      assert.equal(storeAvailability(configs,new Date('2026-10-12T00:59:59Z')).open,true);
      assert.equal(storeAvailability(configs,new Date('2026-10-12T01:00:00Z')).open,false);
    }
  } finally { if(original===undefined)delete process.env.TZ;else process.env.TZ=original; }
});

test('overnight shifts belong to the opening day, including the Sunday/Monday boundary', () => {
  const monday={opening_start:'18:00',opening_end:'02:00',working_days:[1]};
  assert.equal(storeAvailability(monday,new Date('2026-10-12T21:00:00Z')).open,true);
  assert.equal(storeAvailability(monday,new Date('2026-10-13T04:59:59Z')).open,true);
  assert.equal(storeAvailability(monday,new Date('2026-10-13T05:00:00Z')).open,false);
  assert.equal(storeAvailability(monday,new Date('2026-10-12T04:00:00Z')).open,false);
  assert.equal(storeAvailability({...monday,working_days:[0]},new Date('2026-10-12T04:00:00Z')).open,true);
});

test('manual closure, empty/invalid schedules and local preview are handled explicitly', () => {
  const now=new Date('2026-10-11T15:00:00Z');
  assert.deepEqual(storeAvailability({force_closed:'true'},now),{open:false,forceClosed:true});
  for(const config of [{working_days:[]},{working_days:'invalid'},{working_days:[7]},{opening_start:'25:00'},{opening_start:'10:00',opening_end:'10:00'}]) assert.equal(storeAvailability(config,now).open,false);
  assert.equal(storeAvailability({preview_mode:'true',force_closed:'true'},now).open,true);
  assert.equal(openingTime(0,10),'00:00');
  assert.equal(openingTime('7',10),'07:00');
  assert.equal(openingTime(undefined,10),'10:00');
  assert.equal(openingTime('bad',10),null);
});
