import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath, URL} from 'node:url';
export default defineConfig({
 plugins:[react()],
 resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
 server:{host:'127.0.0.1',port:5173,strictPort:true,open:'/index.local.html',proxy:{'/api':'http://127.0.0.1:8000'}},
 build:{outDir:'local-dist',rolldownOptions:{input:'index.local.html'}}
});
