import {it,expect} from 'vitest';
import {SerialOperation} from './helpers/serial-operation';
it('drains a timed-out caller before reset, including rejected work', async () => {
 const guard=new SerialOperation(); let finish!:()=>void,reset=false;
 const body=guard.run(()=>new Promise<void>(resolve=>{finish=resolve;}));
 await Promise.resolve();
 // The runner stops awaiting a body; the fixture hook must still await it.
 const cleanup=guard.drain().then(()=>{reset=true;});
 await Promise.resolve(); expect(reset).toBe(false);
 expect(()=>guard.run(async()=>{})).toThrow(/still active/);
 finish();await body;await cleanup;expect(reset).toBe(true);
 const failed=guard.run(async()=>{throw new Error('assertion');});
 await expect(failed).rejects.toThrow('assertion');await guard.drain();
 await expect(guard.run(async()=>42)).resolves.toBe(42);
});
it('bounded drain failure quarantines future operations and phase continuation', async () => {
 const guard=new SerialOperation();let finish!:()=>void;
 const body=guard.run(()=>new Promise<void>(resolve=>{finish=resolve;}));
 await expect(guard.drain(5)).rejects.toThrow(/refusing further/);
 expect(()=>guard.run(async()=>{})).toThrow(/quarantined/);
 expect(()=>guard.assertHealthy()).toThrow(/quarantined/);
 await expect(guard.drain()).rejects.toThrow(/quarantined/);
 finish();await body;
 expect(()=>guard.run(async()=>{})).toThrow(/quarantined/);
});
