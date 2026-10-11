import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shopDate,validateSchedule} from '../src/utils/order-schedule';
const now=new Date('2026-10-11T15:00:00Z');
const configs={opening_start:'10:00',opening_end:'22:00',working_days:'[1,2,3,4,5]'};
test('scheduling validates future dates and the saved timetable before accepting the order',()=>{
 assert.equal(validateSchedule(undefined,configs,now),undefined);
 assert.equal(validateSchedule('2026-10-12T10:00',configs,now),'2026-10-12T10:00:00-03:00');
 for(const value of ['2026-10-10T10:00','2026-10-11T12:00','2026-10-12T09:59','2026-10-12T22:00','2026-10-17T15:00','2026-02-30T15:00','2026-13-01T15:00','not-a-date',true])assert.throws(()=>validateSchedule(value,configs,now));
 assert.throws(()=>validateSchedule('2026-10-12T15:00',{...configs,working_days:'[]'},now));
 assert.throws(()=>validateSchedule('2026-10-12T09:00',{...configs,preview_mode:'true'},now));
 assert.equal(validateSchedule('2026-10-12T15:00',{...configs,force_closed:'true'},now),'2026-10-12T15:00:00-03:00');
});
test('scheduling and minimum date use the shop timezone and support overnight opening days',()=>{
 const old=process.env.TZ;
 try {for(const zone of ['UTC','Asia/Tokyo','America/Los_Angeles']){
  process.env.TZ=zone;
  assert.equal(shopDate(new Date('2026-10-12T01:00:00Z')),'2026-10-11');
  const overnight={opening_start:'18:00',opening_end:'02:00',working_days:[1]};
  assert.equal(validateSchedule('2026-10-13T01:30:00-03:00',overnight,now),'2026-10-13T01:30:00-03:00');
  assert.throws(()=>validateSchedule('2026-10-13T02:00',overnight,now));
  assert.throws(()=>validateSchedule('2026-10-12T01:30',overnight,now));
 }}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
