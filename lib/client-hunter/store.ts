import { env } from 'cloudflare:workers';
import { Campaign } from './types';
export function owner(r:Request){return r.headers.get('oai-authenticated-user-id')||'private-owner';}
export function db(){if(!env.DB)throw new Error('Database is not available.');return env.DB;}
export async function load(id:string,user:string){return await db().prepare('SELECT * FROM campaigns WHERE id=? AND owner=?').bind(id,user).first<{data:string,revision:number,locked_until:number}>();}
export async function save(c:Campaign,user:string,revision:number){
 return db().prepare('UPDATE campaigns SET data=?,updated=?,revision=revision+1,locked_until=0 WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(c),Date.now(),c.id,user,revision).run();
}
export async function remove(id:string,user:string){
 return db().prepare('DELETE FROM campaigns WHERE id=? AND owner=?').bind(id,user).run();
}

