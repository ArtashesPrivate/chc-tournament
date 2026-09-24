import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['icon.svg','chc-logo.png'],manifest:{name:'CHC Tournament',short_name:'CHC Toernooi',description:'Toernooiplanning, live uitslagen en standen voor SV CHC.',theme_color:'#0d6b3b',background_color:'#f3f6f4',display:'standalone',orientation:'any',start_url:'/',scope:'/',icons:[{src:'/chc-logo.png',sizes:'452x452',type:'image/png',purpose:'any'},{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'maskable'}]},workbox:{navigateFallback:'/index.html',globPatterns:['**/*.{js,css,html,svg,png}']}})]})
