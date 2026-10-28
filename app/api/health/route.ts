import {configuration,keyContext} from '@/lib/client-hunter/providers';
import {owner} from '@/lib/client-hunter/store';
import {readSettings} from '@/lib/client-hunter/settings';
export async function GET(r:Request){try{const s=await readSettings(owner(r));return Response.json(keyContext.run(s,()=>({...configuration(),sender:s.sender||'',user:{name:'My account'}})))}catch{return Response.json({...configuration(),user:{name:'My account'}})}}
